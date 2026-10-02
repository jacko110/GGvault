import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Identity } from '../auth/auth.guard';
import { fail, serializable } from '../common/domain';
import { PrismaService } from '../database/prisma.service';
import { matchEvent } from './match-provision';
import { ResultDto } from './matches.dto';
import { LedgerService } from '../ledger/ledger.service';

export const matchSelect = {
  id: true,
  challengeId: true,
  status: true,
  startedAt: true,
  createdAt: true,
  participants: {
    select: {
      userId: true,
      readyAt: true,
      user: { select: { username: true, displayName: true } },
    },
    orderBy: { userId: 'asc' as const },
  },
  challenge: {
    select: {
      id: true,
      status: true,
      platform: true,
      entryFee: true,
      currency: true,
      createdByUserId: true,
      game: { select: { id: true, name: true } },
    },
  },
  results: {
    select: {
      id: true,
      status: true,
      myScore: true,
      opponentScore: true,
      winnerUserId: true,
      submittedByUserId: true,
      submittedAt: true,
      confirmedByUserId: true,
      confirmedAt: true,
      vaultAmount: true,
      winnerAmount: true,
      platformFee: true,
      settledAt: true,
      winner: { select: { id: true, username: true } },
      disputes: {
        select: {
          id: true,
          reason: true,
          status: true,
          raisedByUserId: true,
          createdAt: true,
          resolution: true,
          resolutionReason: true,
          resolvedByUserId: true,
          resolvedAt: true,
        },
      },
    },
  },
} satisfies Prisma.MatchSelect;

@Injectable()
export class MatchesService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async access(
    tx: Prisma.TransactionClient,
    id: string,
    actor: Identity,
    write = false,
  ) {
    const match = await tx.match.findUnique({
      where: { id },
      select: matchSelect,
    });
    if (!match) fail(404, 'MATCH_NOT_FOUND', 'Match not found.');
    const user = await tx.user.findUnique({
      where: { id: actor.sub },
      select: { role: true, status: true },
    });
    if (user?.status !== 'ACTIVE')
      fail(403, 'USER_INACTIVE', 'Account is not active.');
    const participant = match.participants.some((p) => p.userId === actor.sub);
    if (!participant && (write || !['ADMIN', 'MODERATOR'].includes(user.role)))
      fail(
        403,
        'MATCH_NOT_PARTICIPANT',
        'Only participants may perform this action.',
      );
    return match;
  }

  // All mutations touch the match row, serializing ready/result/decision/evidence races across instances.
  async mutation(tx: Prisma.TransactionClient, id: string, actor: Identity) {
    const match = await this.access(tx, id, actor, true);
    await tx.match.update({ where: { id }, data: { updatedAt: new Date() } });
    return match;
  }

  async detail(id: string, actor: Identity) {
    return serializable(this.db, async (tx) => {
      const match = await this.access(tx, id, actor);
      const vault = await tx.ledgerAccount.findUnique({
        where: {
          challengeId_accountType: {
            challengeId: match.challengeId,
            accountType: 'MATCH_VAULT',
          },
        },
        include: { transactions: true },
      });
      const { entryFee, ...challenge } = match.challenge;
      return {
        ...match,
        challenge: { ...challenge, stakeAmount: entryFee },
        vault: {
          balance:
            vault?.transactions.reduce(
              (sum, e) =>
                sum + (e.direction === 'CREDIT' ? e.amount : -e.amount),
              0,
            ) ?? 0,
          status: ['SETTLED', 'REFUNDED'].includes(match.status)
            ? match.status
            : 'LOCKED',
        },
        settlement: settlementView(match),
      };
    });
  }

  ready(id: string, actor: Identity) {
    return serializable(this.db, async (tx) => {
      const match = await this.mutation(tx, id, actor);
      const participant = match.participants.find(
        (p) => p.userId === actor.sub,
      )!;
      if (participant.readyAt)
        return {
          id: match.id,
          status: match.status,
          readyAt: participant.readyAt,
          startedAt: match.startedAt,
        };
      if (match.status !== 'READY' || match.participants.length !== 2)
        fail(
          409,
          'MATCH_NOT_READY',
          'Match cannot accept readiness in this state.',
        );
      const now = new Date();
      await tx.matchParticipant.update({
        where: { matchId_userId: { matchId: id, userId: actor.sub } },
        data: { readyAt: now },
      });
      await matchEvent(tx, id, 'PLAYER_READY', actor.sub);
      const allReady = match.participants.every(
        (p) => p.userId === actor.sub || p.readyAt,
      );
      if (allReady) {
        await tx.match.update({
          where: { id },
          data: { status: 'IN_PROGRESS', startedAt: now },
        });
        await tx.challenge.update({
          where: { id: match.challengeId },
          data: { status: 'IN_PROGRESS' },
        });
        await matchEvent(tx, id, 'MATCH_STARTED', null);
      }
      return {
        id,
        status: allReady ? 'IN_PROGRESS' : 'READY',
        readyAt: now,
        startedAt: allReady ? now : null,
      };
    });
  }

  submit(id: string, actor: Identity, dto: ResultDto) {
    if (dto.myScore === dto.opponentScore)
      fail(400, 'DRAW_UNSUPPORTED', 'Draws are not supported.');
    return serializable(this.db, async (tx) => {
      const match = await this.mutation(tx, id, actor);
      if (match.results.length)
        fail(
          409,
          'RESULT_ALREADY_SUBMITTED',
          'A result has already been submitted.',
        );
      if (match.status !== 'IN_PROGRESS')
        fail(409, 'MATCH_NOT_IN_PROGRESS', 'Match must be in progress.');
      const opponent = match.participants.find((p) => p.userId !== actor.sub);
      if (!opponent || match.participants.length !== 2)
        fail(
          409,
          'MATCH_INVALID_PARTICIPANTS',
          'Match requires two participants.',
        );
      const result = await tx.matchResult.create({
        data: {
          matchId: id,
          myScore: dto.myScore,
          opponentScore: dto.opponentScore,
          submittedByUserId: actor.sub,
          submittedAt: new Date(),
          winnerUserId:
            dto.myScore > dto.opponentScore ? actor.sub : opponent.userId,
        },
      });
      await tx.match.update({
        where: { id },
        data: { status: 'RESULT_SUBMITTED' },
      });
      await tx.challenge.update({
        where: { id: match.challengeId },
        data: { status: 'RESULT_SUBMITTED' },
      });
      await matchEvent(tx, id, 'RESULT_SUBMITTED', actor.sub);
      return {
        id: result.id,
        status: result.status,
        myScore: result.myScore,
        opponentScore: result.opponentScore,
        winnerUserId: result.winnerUserId,
        submittedByUserId: result.submittedByUserId,
        submittedAt: result.submittedAt,
      };
    });
  }

  decide(id: string, actor: Identity, reason?: string) {
    return serializable(this.db, async (tx) => {
      const match = await this.mutation(tx, id, actor);
      const result = match.results[0];
      if (!result)
        fail(409, 'RESULT_NOT_SUBMITTED', 'No result has been submitted.');
      if (result.submittedByUserId === actor.sub)
        fail(
          403,
          'RESULT_SELF_DECISION',
          'Only the non-submitting opponent can decide.',
        );
      if (
        reason === undefined &&
        match.status === 'SETTLED' &&
        result.confirmedByUserId === actor.sub &&
        !result.disputes.length
      )
        return {
          matchId: id,
          resultId: result.id,
          status: 'SETTLED',
          settlement: settlementView(match),
        };
      // Resume an approved Phase 4 confirmation without inventing a new player-facing settlement action.
      if (
        reason === undefined &&
        match.status === 'CONFIRMED' &&
        result.status === 'CONFIRMED' &&
        result.confirmedByUserId === actor.sub &&
        !result.disputes.length
      ) {
        await this.ledger.settleMatch(
          {
            matchId: id,
            winnerUserId: result.winnerUserId!,
            idempotencyKey: `match-settlement:${id}`,
            actorUserId: actor.sub,
          },
          tx,
        );
        const final = await tx.match.findUniqueOrThrow({
          where: { id },
          select: matchSelect,
        });
        return {
          matchId: id,
          resultId: result.id,
          status: 'SETTLED',
          settlement: settlementView(final),
        };
      }
      if (match.status !== 'RESULT_SUBMITTED' || result.status !== 'PENDING')
        fail(409, 'RESULT_FINALIZED', 'Result has already been decided.');
      const disputed = reason !== undefined;
      const status = disputed ? 'DISPUTED' : 'CONFIRMED';
      const dispute = disputed
        ? await tx.dispute.create({
            data: {
              matchResultId: result.id,
              raisedByUserId: actor.sub,
              reason,
              status: 'REVIEW',
            },
          })
        : null;
      await tx.matchResult.update({
        where: { id: result.id },
        data: {
          status,
          ...(!disputed
            ? { confirmedByUserId: actor.sub, confirmedAt: new Date() }
            : {}),
        },
      });
      await tx.match.update({ where: { id }, data: { status } });
      await tx.challenge.update({
        where: { id: match.challengeId },
        data: { status },
      });
      await matchEvent(
        tx,
        id,
        disputed ? 'RESULT_DISPUTED' : 'RESULT_CONFIRMED',
        actor.sub,
        {
          matchId: id,
          challengeId: match.challengeId,
          ...(dispute ? { disputeId: dispute.id } : {}),
        },
      );
      if (dispute)
        await matchEvent(tx, id, 'DISPUTE_OPENED', actor.sub, {
          matchId: id,
          challengeId: match.challengeId,
          disputeId: dispute.id,
        });
      if (!disputed) {
        await this.ledger.settleMatch(
          {
            matchId: id,
            winnerUserId: result.winnerUserId!,
            idempotencyKey: `match-settlement:${id}`,
            actorUserId: actor.sub,
          },
          tx,
        );
        const final = await tx.match.findUniqueOrThrow({
          where: { id },
          select: matchSelect,
        });
        return {
          matchId: id,
          resultId: result.id,
          status: 'SETTLED',
          settlement: settlementView(final),
        };
      }
      return { matchId: id, resultId: result.id, status, settlement: null };
    });
  }

  timeline(id: string, actor: Identity) {
    return serializable(this.db, async (tx) => {
      await this.access(tx, id, actor);
      return tx.matchEvent.findMany({
        where: { matchId: id },
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          type: true,
          actorUserId: true,
          createdAt: true,
        },
      });
    });
  }
}

export function settlementView(
  match: Prisma.MatchGetPayload<{ select: typeof matchSelect }>,
) {
  const result = match.results[0];
  if (!result || !['SETTLED', 'REFUNDED'].includes(result.status)) return null;
  return {
    matchId: match.id,
    status: result.status,
    winner: result.winner,
    vaultAmount: result.vaultAmount,
    winnerAmount: result.winnerAmount,
    platformFee: result.platformFee,
  };
}
