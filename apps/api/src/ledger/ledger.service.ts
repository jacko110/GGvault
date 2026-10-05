import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerAccountType,
  LedgerDirection,
  LedgerTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { SettlementPolicy } from './settlement.policy';
import { matchEvent } from '../matches/match-provision';
import { serializable } from '../common/domain';
import { observeSuboperation } from '../common/transaction-observation';

interface CreateInitialCreditInput {
  userId: string;
  amount: number;
  idempotencyKey: string;
}

interface LockStakeInput {
  userId: string;
  challengeId: string;
  amount: number;
  idempotencyKey: string;
}

interface SettleMatchInput {
  matchId: string;
  winnerUserId: string;
  idempotencyKey: string;
  actorUserId?: string;
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SettlementPolicy = new SettlementPolicy(),
  ) {}

  private async runSerializableTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return serializable(this.prisma, fn);
  }

  private withTransaction<T>(
    tx: Prisma.TransactionClient | undefined,
    fn: (client: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return tx ? fn(tx) : this.runSerializableTransaction(fn);
  }

  private async getAccountBalance(
    tx: Prisma.TransactionClient,
    accountId: string,
  ): Promise<number> {
    const entries = await tx.ledgerEntry.findMany({
      where: { ledgerAccountId: accountId },
    });
    return entries.reduce(
      (sum, entry) =>
        sum +
        (entry.direction === LedgerDirection.CREDIT
          ? entry.amount
          : -entry.amount),
      0,
    );
  }

  private async getUserAvailableAccount(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{
    id: string;
    accountType: LedgerAccountType;
    userId: string | null;
  }> {
    return tx.ledgerAccount.upsert({
      where: {
        userId_accountType: {
          userId,
          accountType: LedgerAccountType.USER_AVAILABLE,
        },
      },
      update: {},
      create: {
        userId,
        accountType: LedgerAccountType.USER_AVAILABLE,
        name: `User ${userId} available balance`,
      },
    });
  }

  private async getChallengeVaultAccount(
    tx: Prisma.TransactionClient,
    challengeId: string,
  ): Promise<{
    id: string;
    challengeId: string | null;
    accountType: LedgerAccountType;
  }> {
    return tx.ledgerAccount.upsert({
      where: {
        challengeId_accountType: {
          challengeId,
          accountType: LedgerAccountType.MATCH_VAULT,
        },
      },
      update: {},
      create: {
        challengeId,
        accountType: LedgerAccountType.MATCH_VAULT,
        name: `Challenge ${challengeId} vault`,
      },
    });
  }

  private async getPlatformRevenueAccount(
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string; accountType: LedgerAccountType }> {
    // Use singletonKey to ensure a single global account row
    const singletonKey = 'GLOBAL_PLATFORM_REVENUE';
    return tx.ledgerAccount.upsert({
      where: { singletonKey },
      update: {},
      create: {
        singletonKey,
        accountType: LedgerAccountType.PLATFORM_REVENUE,
        name: 'Platform revenue',
      },
    });
  }

  private async getSystemAccount(tx: Prisma.TransactionClient) {
    const singletonKey = 'GLOBAL_SYSTEM_ACCOUNT';
    return tx.ledgerAccount.upsert({
      where: { singletonKey },
      update: {},
      create: {
        singletonKey,
        accountType: LedgerAccountType.SYSTEM,
        name: 'System funding account',
      },
    });
  }

  async createInitialCredit(
    input: CreateInitialCreditInput,
    transactionClient?: Prisma.TransactionClient,
  ) {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }
    try {
      return await this.withTransaction(transactionClient, async (tx) => {
        const user = await tx.user.findUnique({ where: { id: input.userId } });
        if (!user) {
          throw new NotFoundException(`User ${input.userId} not found`);
        }

        const existing = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { entries: true },
        });

        if (existing) {
          return existing;
        }

        const systemAccount = await this.getSystemAccount(tx);
        const userAvailableAccount = await this.getUserAvailableAccount(
          tx,
          input.userId,
        );

        const txRecord = await tx.ledgerTransaction.create({
          data: {
            type: LedgerTransactionType.INITIAL_CREDIT,
            idempotencyKey: input.idempotencyKey,
            description: `Initial test credit for ${input.userId}`,
            entries: {
              create: [
                {
                  ledgerAccountId: systemAccount.id,
                  direction: LedgerDirection.DEBIT,
                  amount: input.amount,
                  description: 'System funding allocation',
                },
                {
                  ledgerAccountId: userAvailableAccount.id,
                  direction: LedgerDirection.CREDIT,
                  amount: input.amount,
                  description: 'User initial credit',
                },
              ],
            },
          },
          include: { entries: true },
        });

        return txRecord;
      });
    } catch (error) {
      if (
        !transactionClient &&
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { entries: true },
        });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  async lockStake(
    input: LockStakeInput,
    transactionClient?: Prisma.TransactionClient,
  ) {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException('amount must be a positive integer');
    }

    try {
      return await this.withTransaction(transactionClient, async (tx) => {
        const user = await tx.user.findUnique({ where: { id: input.userId } });
        if (!user) {
          throw new NotFoundException(`User ${input.userId} not found`);
        }

        const challenge = await tx.challenge.findUnique({
          where: { id: input.challengeId },
        });
        if (!challenge) {
          throw new NotFoundException(
            `Challenge ${input.challengeId} not found`,
          );
        }

        const existingTx = await tx.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { entries: true },
        });

        if (existingTx) {
          return existingTx;
        }

        const challengePlayer = await tx.challengePlayer.findUnique({
          where: {
            challengeId_userId: {
              challengeId: input.challengeId,
              userId: input.userId,
            },
          },
        });

        if (!challengePlayer) {
          throw new NotFoundException(
            `User ${input.userId} is not a player in challenge ${input.challengeId}`,
          );
        }

        if (
          challengePlayer.status === 'FUNDED' ||
          challengePlayer.status === 'LOCKED'
        ) {
          throw new ConflictException(
            'Stake already locked for this player and challenge',
          );
        }

        const userAccount = await this.getUserAvailableAccount(
          tx,
          input.userId,
        );
        const vaultAccount = await this.getChallengeVaultAccount(
          tx,
          input.challengeId,
        );

        const availableBalance = await this.getAccountBalance(
          tx,
          userAccount.id,
        );
        if (availableBalance < input.amount) {
          throw new BadRequestException(
            'Insufficient credits to lock this stake',
          );
        }

        const transaction = await tx.ledgerTransaction.create({
          data: {
            type: LedgerTransactionType.STAKE_LOCK,
            idempotencyKey: input.idempotencyKey,
            description: `Stake lock for challenge ${input.challengeId}`,
            entries: {
              create: [
                {
                  ledgerAccountId: userAccount.id,
                  direction: LedgerDirection.DEBIT,
                  amount: input.amount,
                  description: 'User stake lock',
                },
                {
                  ledgerAccountId: vaultAccount.id,
                  direction: LedgerDirection.CREDIT,
                  amount: input.amount,
                  description: 'Challenge vault funding',
                },
              ],
            },
          },
          include: { entries: true },
        });
        await tx.challengePlayer.update({
          where: {
            challengeId_userId: {
              challengeId: input.challengeId,
              userId: input.userId,
            },
          },
          data: {
            status: 'FUNDED',
            lockedAt: new Date(),
          },
        });

        // Only mark the challenge FUNDED when all players are funded/locked
        const players = await tx.challengePlayer.findMany({
          where: { challengeId: input.challengeId },
        });
        const allFundedOrLocked =
          players.length > 0 &&
          players.every((p) => p.status === 'FUNDED' || p.status === 'LOCKED');

        if (allFundedOrLocked) {
          await tx.challenge.update({
            where: { id: input.challengeId },
            data: { status: 'FUNDED' },
          });
        }

        return transaction;
      });
    } catch (error) {
      if (
        !transactionClient &&
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.ledgerTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { entries: true },
        });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  async settleMatch(
    input: SettleMatchInput,
    transactionClient?: Prisma.TransactionClient,
  ) {
    return observeSuboperation('settlement', () =>
      this.settleMatchWork(input, transactionClient),
    );
  }

  private async settleMatchWork(
    input: SettleMatchInput,
    transactionClient?: Prisma.TransactionClient,
  ) {
    try {
      return await this.withTransaction(transactionClient, async (tx) => {
        const match = await tx.match.findUnique({
          where: { id: input.matchId },
          include: { challenge: { include: { players: true } } },
        });
        if (!match) throw new NotFoundException('Match not found');
        await tx.match.update({
          where: { id: match.id },
          data: { updatedAt: new Date() },
        });
        const existing = await tx.ledgerTransaction.findUnique({
          where: {
            matchId_type: { matchId: input.matchId, type: 'MATCH_SETTLEMENT' },
          },
          include: { entries: true },
        });

        if (existing) {
          const result = await tx.matchResult.findUniqueOrThrow({
            where: { matchId: input.matchId },
          });
          if (result.winnerUserId !== input.winnerUserId)
            throw new ConflictException('Settlement winner cannot change');
          return existing;
        }

        const matchResult = await tx.matchResult.findUnique({
          where: { matchId: input.matchId },
        });
        if (!matchResult) {
          throw new NotFoundException(
            `Match result for match ${input.matchId} not found`,
          );
        }

        const dispute = await tx.dispute.findUnique({
          where: { matchResultId: matchResult.id },
        });
        const confirmed =
          matchResult.status === 'CONFIRMED' &&
          match.status === 'CONFIRMED' &&
          !dispute;
        const resolved =
          matchResult.status === 'RESOLVED' &&
          match.status === 'DISPUTED' &&
          dispute?.status === 'RESOLVED' &&
          ['PLAYER_A_WINS', 'PLAYER_B_WINS'].includes(dispute.resolution ?? '');
        if (
          (!confirmed && !resolved) ||
          matchResult.winnerUserId !== input.winnerUserId ||
          match.challenge.currency !== 'TEST' ||
          match.challenge.players.length !== 2 ||
          !match.challenge.players.some((p) => p.userId === input.winnerUserId)
        )
          throw new ConflictException('Match has no verified payable outcome');

        const vaultAccount = await this.getChallengeVaultAccount(
          tx,
          match.challengeId,
        );
        const winnerAccount = await this.getUserAvailableAccount(
          tx,
          input.winnerUserId,
        );
        const platformAccount = await this.getPlatformRevenueAccount(tx);

        const vaultBalance = await this.getAccountBalance(tx, vaultAccount.id);
        const {
          platformFee,
          winnerAmount: winnerPayout,
          feeBasisPoints,
        } = this.policy.calculate(vaultBalance);

        if (vaultBalance <= 0 || winnerPayout < 0) {
          throw new BadRequestException(
            'Vault balance is insufficient for settlement',
          );
        }

        const context = {
          matchId: match.id,
          challengeId: match.challengeId,
          ...(dispute
            ? { disputeId: dispute.id, resolution: dispute.resolution! }
            : {}),
        };
        await matchEvent(
          tx,
          match.id,
          'SETTLEMENT_STARTED',
          input.actorUserId ?? null,
          context,
        );
        const transaction = await tx.ledgerTransaction.create({
          data: {
            matchId: input.matchId,
            type: LedgerTransactionType.MATCH_SETTLEMENT,
            idempotencyKey: input.idempotencyKey,
            description: `Match settlement for ${input.matchId}`,
            entries: {
              create: [
                {
                  ledgerAccountId: vaultAccount.id,
                  direction: LedgerDirection.DEBIT,
                  amount: vaultBalance,
                  description: 'Match vault payout',
                },
                {
                  ledgerAccountId: winnerAccount.id,
                  direction: LedgerDirection.CREDIT,
                  amount: winnerPayout,
                  description: 'Winner payout',
                },
                {
                  ledgerAccountId: platformAccount.id,
                  direction: LedgerDirection.CREDIT,
                  amount: platformFee,
                  description: 'Platform fee',
                },
              ].filter((entry) => entry.amount > 0),
            },
          },
          include: { entries: true },
        });

        await tx.matchResult.update({
          where: { matchId: input.matchId },
          data: {
            winnerUserId: input.winnerUserId,
            status: 'SETTLED',
            vaultAmount: vaultBalance,
            winnerAmount: winnerPayout,
            platformFee,
            feeBasisPoints,
            settledAt: new Date(),
          },
        });
        await tx.match.update({
          where: { id: match.id },
          data: { status: 'SETTLED' },
        });
        await tx.challenge.update({
          where: { id: match.challengeId },
          data: { status: 'SETTLED' },
        });
        await matchEvent(
          tx,
          match.id,
          'MATCH_SETTLED',
          input.actorUserId ?? null,
          context,
        );
        return transaction;
      });
    } catch (error) {
      if (
        !transactionClient &&
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // If a different idempotency key attempted settlement for the same match,
        // the database unique constraint on (matchId, type) will surface as P2002.
        // Return the already-created MATCH_SETTLEMENT for this match if present.
        const existingByMatch = await this.prisma.ledgerTransaction.findFirst({
          where: {
            matchId: input.matchId,
            type: LedgerTransactionType.MATCH_SETTLEMENT,
          },
          include: { entries: true },
        });

        if (existingByMatch) {
          const result = await this.prisma.matchResult.findUniqueOrThrow({
            where: { matchId: input.matchId },
          });
          if (result.winnerUserId !== input.winnerUserId)
            throw new ConflictException('Settlement winner cannot change');
          return existingByMatch;
        }
      }

      throw error;
    }
  }

  async refundMatch(
    input: { matchId: string; actorUserId?: string },
    transactionClient?: Prisma.TransactionClient,
  ) {
    return this.withTransaction(transactionClient, async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: input.matchId },
        include: {
          challenge: { include: { players: true } },
          results: { include: { disputes: true } },
        },
      });
      if (!match) throw new NotFoundException('Match not found');
      await tx.match.update({
        where: { id: match.id },
        data: { updatedAt: new Date() },
      });
      const existing = await tx.ledgerTransaction.findUnique({
        where: { matchId_type: { matchId: match.id, type: 'STAKE_REFUND' } },
        include: { entries: true },
      });
      if (existing) return existing;
      const result = match.results[0],
        dispute = result?.disputes[0];
      if (
        match.status !== 'DISPUTED' ||
        result?.status !== 'RESOLVED' ||
        dispute?.status !== 'RESOLVED' ||
        dispute.resolution !== 'VOID_MATCH' ||
        match.challenge.currency !== 'TEST'
      )
        throw new ConflictException('Match has no verified void outcome');
      const vault = await this.getChallengeVaultAccount(tx, match.challengeId);
      const locks = await tx.ledgerTransaction.findMany({
        where: {
          type: 'STAKE_LOCK',
          entries: { some: { ledgerAccountId: vault.id, direction: 'CREDIT' } },
        },
        include: { entries: { include: { ledgerAccount: true } } },
      });
      const refunds = new Map<string, number>();
      for (const lock of locks) {
        const credits = lock.entries
          .filter(
            (e) => e.ledgerAccountId === vault.id && e.direction === 'CREDIT',
          )
          .reduce((s, e) => s + e.amount, 0);
        const debits = lock.entries.filter(
          (e) =>
            e.direction === 'DEBIT' &&
            e.ledgerAccount.accountType === 'USER_AVAILABLE',
        );
        if (
          debits.length !== 1 ||
          debits[0].amount !== credits ||
          !match.challenge.players.some(
            (p) => p.userId === debits[0].ledgerAccount.userId,
          )
        )
          throw new ConflictException('Invalid original stake accounting');
        refunds.set(
          debits[0].ledgerAccountId,
          (refunds.get(debits[0].ledgerAccountId) ?? 0) + credits,
        );
      }
      const total = [...refunds.values()].reduce((s, n) => s + n, 0);
      if (
        refunds.size !== 2 ||
        total <= 0 ||
        (await this.getAccountBalance(tx, vault.id)) !== total
      )
        throw new ConflictException('Vault does not match original stakes');
      const transaction = await tx.ledgerTransaction.create({
        data: {
          matchId: match.id,
          type: 'STAKE_REFUND',
          idempotencyKey: `match-refund:${match.id}`,
          description: 'Voided match stake refunds',
          entries: {
            create: [
              {
                ledgerAccountId: vault.id,
                direction: LedgerDirection.DEBIT,
                amount: total,
              },
              ...[...refunds].map(([ledgerAccountId, amount]) => ({
                ledgerAccountId,
                direction: LedgerDirection.CREDIT,
                amount,
              })),
            ],
          },
        },
        include: { entries: true },
      });
      await tx.matchResult.update({
        where: { id: result.id },
        data: {
          status: 'REFUNDED',
          winnerUserId: null,
          vaultAmount: total,
          winnerAmount: 0,
          platformFee: 0,
          settledAt: new Date(),
        },
      });
      await tx.match.update({
        where: { id: match.id },
        data: { status: 'REFUNDED' },
      });
      await tx.challenge.update({
        where: { id: match.challengeId },
        data: { status: 'REFUNDED' },
      });
      await matchEvent(
        tx,
        match.id,
        'MATCH_REFUNDED',
        input.actorUserId ?? null,
        {
          matchId: match.id,
          challengeId: match.challengeId,
          disputeId: dispute.id,
          resolution: 'VOID_MATCH',
        },
      );
      return transaction;
    });
  }

  async getUserBalance(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const account = await this.prisma.ledgerAccount.findFirst({
      where: { userId, accountType: LedgerAccountType.USER_AVAILABLE },
    });

    if (!account) {
      return { userId, balance: 0 };
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { ledgerAccountId: account.id },
    });
    const balance = entries.reduce(
      (sum, entry) =>
        sum +
        (entry.direction === LedgerDirection.CREDIT
          ? entry.amount
          : -entry.amount),
      0,
    );

    return { userId, balance };
  }

  async history(userId: string, cursor?: string, limit = 20) {
    const where: Prisma.LedgerEntryWhereInput = {
      ledgerAccount: { userId, accountType: 'USER_AVAILABLE' },
    };
    const anchor = cursor
      ? await this.prisma.ledgerEntry.findFirst({
          where: { ...where, id: cursor },
        })
      : null;
    if (cursor && !anchor)
      throw new BadRequestException('Invalid transaction cursor');
    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        ...where,
        ...(anchor
          ? {
              OR: [
                { createdAt: { lt: anchor.createdAt } },
                { createdAt: anchor.createdAt, id: { lt: anchor.id } },
              ],
            }
          : {}),
      },
      include: {
        transaction: {
          include: { entries: { include: { ledgerAccount: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map((e) => {
        const type =
          e.transaction.type === 'MATCH_SETTLEMENT'
            ? 'MATCH_WIN'
            : e.transaction.type;
        const descriptions: Record<string, string> = {
          INITIAL_CREDIT: 'Initial non-withdrawable test credits',
          STAKE_LOCK: 'Challenge stake locked',
          MATCH_WIN: 'Match prize',
          STAKE_REFUND: 'Voided match stake returned',
        };
        return {
          id: e.id,
          timestamp: e.createdAt,
          type,
          amount: e.direction === 'CREDIT' ? e.amount : -e.amount,
          challengeId:
            e.transaction.entries.find(
              (x) => x.ledgerAccount.accountType === 'MATCH_VAULT',
            )?.ledgerAccount.challengeId ?? null,
          matchId: e.transaction.matchId,
          description: descriptions[type] ?? 'Test credit transaction',
        };
      }),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }

  async getUserLedger(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { userId },
      include: { transactions: true },
    });

    return {
      userId,
      accounts: accounts.map((account) => ({
        id: account.id,
        type: account.accountType,
        name: account.name,
        balance: account.transactions.reduce(
          (sum, entry) =>
            sum +
            (entry.direction === LedgerDirection.CREDIT
              ? entry.amount
              : -entry.amount),
          0,
        ),
      })),
      entries: accounts.flatMap((account) => account.transactions),
    };
  }

  async getChallengeVault(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge) {
      throw new NotFoundException(`Challenge ${challengeId} not found`);
    }

    const vault = await this.prisma.ledgerAccount.findFirst({
      where: { challengeId, accountType: LedgerAccountType.MATCH_VAULT },
    });

    if (!vault) {
      return { challengeId, vaultAccountId: null, balance: 0 };
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { ledgerAccountId: vault.id },
    });
    const balance = entries.reduce(
      (sum, entry) =>
        sum +
        (entry.direction === LedgerDirection.CREDIT
          ? entry.amount
          : -entry.amount),
      0,
    );

    return { challengeId, vaultAccountId: vault.id, balance };
  }
}
