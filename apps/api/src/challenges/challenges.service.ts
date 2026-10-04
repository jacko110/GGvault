import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { audit, fail, serializable } from '../common/domain';
import { CreateChallengeDto, DiscoverDto } from './challenges.dto';
import { ensureFundedMatch } from '../matches/match-provision';
import { betaConfig } from '../common/beta-config';

const challengeSelect = {
  id: true,
  gameId: true,
  createdByUserId: true,
  status: true,
  entryFee: true,
  currency: true,
  platform: true,
  mode: true,
  createdAt: true,
  matches: { select: { id: true, status: true } },
  players: {
    select: {
      userId: true,
      status: true,
      joinedAt: true,
      user: { select: { username: true, displayName: true } },
    },
  },
} satisfies Prisma.ChallengeSelect;
type ChallengeView = Prisma.ChallengeGetPayload<{
  select: typeof challengeSelect;
}>;
function view(challenge: ChallengeView) {
  const { entryFee, createdByUserId, ...rest } = challenge;
  return { ...rest, creatorId: createdByUserId, stakeAmount: entryFee };
}

@Injectable()
export class ChallengesService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
  ) {}
  private async active(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user?.status !== 'ACTIVE')
      fail(403, 'USER_INACTIVE', 'Account is not active.');
  }
  private async account(
    tx: Prisma.TransactionClient,
    userId: string,
    gameId: string,
    platform: string,
  ) {
    const account = await tx.gameAccount.findUnique({
      where: { userId_gameId_platform: { userId, gameId, platform } },
    });
    if (!account)
      fail(
        400,
        'GAME_ACCOUNT_REQUIRED',
        'A matching game/platform account is required.',
      );
  }
  private async get(tx: Prisma.TransactionClient, id: string) {
    const challenge = await tx.challenge.findUnique({
      where: { id },
      select: challengeSelect,
    });
    if (!challenge) fail(404, 'CHALLENGE_NOT_FOUND', 'Challenge not found.');
    return challenge;
  }
  create(userId: string, dto: CreateChallengeDto) {
    return serializable(this.db, async (tx) => {
      await this.active(tx, userId);
      const limits = betaConfig();
      if (limits.enabled) {
        if (dto.stakeAmount > limits.maxStake)
          fail(400, 'BETA_STAKE_LIMIT', 'Stake exceeds the beta limit.');
        const midnight = new Date();
        midnight.setUTCHours(0, 0, 0, 0);
        const open = await tx.challenge.count({
          where: { createdByUserId: userId, status: 'OPEN' },
        });
        const daily = await tx.challenge.count({
          where: { createdByUserId: userId, createdAt: { gte: midnight } },
        });
        if (open >= limits.maxOpen)
          fail(
            409,
            'BETA_OPEN_CHALLENGE_LIMIT',
            'Close an open challenge before creating another.',
          );
        if (daily >= limits.maxDaily)
          fail(
            429,
            'BETA_DAILY_CHALLENGE_LIMIT',
            'Daily challenge limit reached.',
          );
      }
      const game = await tx.game.findUnique({ where: { id: dto.gameId } });
      if (!game?.enabled) fail(400, 'GAME_UNAVAILABLE', 'Game is unavailable.');
      await this.account(tx, userId, dto.gameId, dto.platform);
      const challenge = await tx.challenge.create({
        data: {
          gameId: dto.gameId,
          slug: randomUUID(),
          title: `${game.name} 1v1`,
          createdByUserId: userId,
          entryFee: dto.stakeAmount,
          platform: dto.platform,
          mode: dto.mode,
          currency: 'TEST',
          status: 'OPEN',
          players: { create: { userId } },
        },
        select: challengeSelect,
      });
      await audit(tx, userId, 'CHALLENGE_CREATED', 'Challenge', challenge.id);
      return view(challenge);
    });
  }
  async discover(dto: DiscoverDto) {
    if (
      dto.minimumStake !== undefined &&
      dto.maximumStake !== undefined &&
      dto.minimumStake > dto.maximumStake
    )
      fail(400, 'INVALID_STAKE_RANGE', 'Minimum stake exceeds maximum stake.');
    const items = await this.db.challenge.findMany({
      where: {
        status: dto.status,
        gameId: dto.gameId,
        platform: dto.platform,
        entryFee: { gte: dto.minimumStake, lte: dto.maximumStake },
        ...(dto.cursor ? { id: { gt: dto.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: dto.limit + 1,
      select: challengeSelect,
    });
    const more = items.length > dto.limit;
    const page = items.slice(0, dto.limit);
    return {
      items: page.map(view),
      nextCursor: more ? page[page.length - 1].id : null,
    };
  }
  async detail(id: string) {
    return view(await this.get(this.db, id));
  }
  // Internal domain action only. No public expiration/status mutation endpoint.
  expire(id: string) {
    return serializable(this.db, async (tx) => {
      const challenge = await this.get(tx, id);
      if (challenge.status !== 'OPEN')
        fail(409, 'CHALLENGE_NOT_OPEN', 'Only open challenges can expire.');
      if (
        challenge.players.some(
          (p) => p.status === 'FUNDED' || p.status === 'LOCKED',
        )
      )
        fail(409, 'CHALLENGE_HAS_LOCKED_FUNDS', 'Challenge has locked funds.');
      await tx.challenge.update({ where: { id }, data: { status: 'EXPIRED' } });
      await audit(tx, null, 'CHALLENGE_EXPIRED', 'Challenge', id);
      return view(await this.get(tx, id));
    });
  }
  join(userId: string, id: string) {
    return serializable(this.db, async (tx) => {
      await this.active(tx, userId);
      const challenge = await this.get(tx, id);
      if (challenge.createdByUserId === userId)
        fail(409, 'CHALLENGE_SELF_JOIN', 'You cannot join your own challenge.');
      if (challenge.players.some((p) => p.userId === userId))
        fail(
          409,
          'CHALLENGE_ALREADY_JOINED',
          'You already joined this challenge.',
        );
      if (challenge.players.length >= 2)
        fail(409, 'CHALLENGE_FULL', 'Challenge is full.');
      if (challenge.status !== 'OPEN')
        fail(409, 'CHALLENGE_NOT_OPEN', 'Challenge is not open.');
      const game = await tx.game.findUnique({
        where: { id: challenge.gameId },
      });
      if (!game?.enabled) fail(400, 'GAME_UNAVAILABLE', 'Game is unavailable.');
      await this.account(tx, userId, challenge.gameId, challenge.platform);
      await tx.challengePlayer.create({ data: { userId, challengeId: id } });
      await tx.challenge.update({ where: { id }, data: { status: 'JOINED' } });
      await audit(tx, userId, 'CHALLENGE_JOINED', 'Challenge', id);
      return view(await this.get(tx, id));
    });
  }
  cancel(userId: string, id: string) {
    return serializable(this.db, async (tx) => {
      await this.active(tx, userId);
      const challenge = await this.get(tx, id);
      if (challenge.createdByUserId !== userId)
        fail(403, 'CHALLENGE_NOT_CREATOR', 'Only the creator can cancel.');
      if (
        challenge.players.some(
          (p) => p.status === 'FUNDED' || p.status === 'LOCKED',
        )
      )
        fail(409, 'CHALLENGE_HAS_LOCKED_FUNDS', 'Challenge has locked funds.');
      if (!['OPEN', 'JOINED'].includes(challenge.status))
        fail(
          409,
          'CHALLENGE_INVALID_STATE',
          'Challenge cannot be cancelled in this state.',
        );
      await tx.challenge.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await audit(tx, userId, 'CHALLENGE_CANCELLED', 'Challenge', id);
      return view(await this.get(tx, id));
    });
  }
  fund(userId: string, id: string, key: string | undefined) {
    if (!key || !/^[a-zA-Z0-9:_-]{8,128}$/.test(key))
      fail(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Provide an Idempotency-Key of 8–128 letters, digits, colons, underscores or hyphens.',
      );
    const idempotencyKey = `fund:${createHash('sha256')
      .update(JSON.stringify([userId, id, key]))
      .digest('hex')}`;
    return serializable(this.db, async (tx) => {
      await this.active(tx, userId);
      const challenge = await this.get(tx, id);
      const player = challenge.players.find((p) => p.userId === userId);
      if (!player)
        fail(
          403,
          'CHALLENGE_NOT_PARTICIPANT',
          'Only participants can fund this challenge.',
        );
      const previous = await tx.ledgerTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (!previous) {
        if (player.status === 'FUNDED' || player.status === 'LOCKED')
          fail(
            409,
            'CHALLENGE_ALREADY_FUNDED',
            'Your stake is already funded.',
          );
        if (challenge.status !== 'JOINED' || challenge.players.length !== 2)
          fail(
            409,
            'CHALLENGE_INVALID_STATE',
            'Both participants must join before funding.',
          );
        await this.ledger.lockStake(
          {
            userId,
            challengeId: id,
            amount: challenge.entryFee,
            idempotencyKey,
          },
          tx,
        );
        await audit(tx, userId, 'CHALLENGE_FUNDED', 'Challenge', id);
      }
      const vault = await tx.ledgerAccount.findUnique({
        where: {
          challengeId_accountType: {
            challengeId: id,
            accountType: 'MATCH_VAULT',
          },
        },
        include: { transactions: true },
      });
      const updated = await this.get(tx, id);
      if (updated.status === 'FUNDED') await ensureFundedMatch(tx, id);
      return {
        challenge: view(await this.get(tx, id)),
        player: updated.players.find((p) => p.userId === userId),
        vaultBalance:
          vault?.transactions.reduce(
            (sum, e) => sum + (e.direction === 'CREDIT' ? e.amount : -e.amount),
            0,
          ) ?? 0,
      };
    });
  }
}
