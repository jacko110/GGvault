import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Identity } from '../auth/auth.guard';
import { fail, serializable } from '../common/domain';
import { PrismaService } from '../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { evidenceSelect } from './evidence.service';
import { matchSelect, settlementView } from './matches.service';
import { matchEvent } from './match-provision';
import { DisputeQuery, ResolveDisputeDto } from './moderation.dto';

const disputeSelect = {
  id: true,
  reason: true,
  status: true,
  createdAt: true,
  raisedByUserId: true,
  resolution: true,
  resolutionReason: true,
  resolvedByUserId: true,
  resolvedAt: true,
  matchResult: {
    select: {
      match: {
        select: { ...matchSelect, evidence: { select: evidenceSelect } },
      },
    },
  },
} satisfies Prisma.DisputeSelect;
type Row = Prisma.DisputeGetPayload<{ select: typeof disputeSelect }>;
const present = ({ matchResult: { match }, ...dispute }: Row) => ({
  ...dispute,
  matchId: match.id,
  challengeId: match.challengeId,
  players: match.participants.map((p) => ({
    id: p.userId,
    username: p.user.username,
    slot:
      p.userId === match.challenge.createdByUserId ? 'PLAYER_A' : 'PLAYER_B',
  })),
  proposedResult: match.results[0]
    ? {
        myScore: match.results[0].myScore,
        opponentScore: match.results[0].opponentScore,
        submittedByUserId: match.results[0].submittedByUserId,
        proposedWinnerUserId:
          match.results[0].myScore! > match.results[0].opponentScore!
            ? match.results[0].submittedByUserId
            : match.participants.find(
                (p) => p.userId !== match.results[0].submittedByUserId,
              )?.userId,
      }
    : null,
  evidence: match.evidence,
});

@Injectable()
export class ModerationService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
  ) {}
  private async authorize(tx: Prisma.TransactionClient, actor: Identity) {
    const user = await tx.user.findUnique({ where: { id: actor.sub } });
    if (
      user?.status !== 'ACTIVE' ||
      !['ADMIN', 'MODERATOR'].includes(user.role)
    )
      fail(403, 'AUTH_FORBIDDEN', 'Active moderator or admin required.');
  }
  list(actor: Identity, query: DisputeQuery) {
    return serializable(this.db, async (tx) => {
      await this.authorize(tx, actor);
      if (
        query.createdAfter &&
        query.createdBefore &&
        new Date(query.createdAfter) >= new Date(query.createdBefore)
      )
        fail(
          400,
          'INVALID_DATE_RANGE',
          'createdAfter must precede createdBefore.',
        );
      const anchor = query.cursor
        ? await tx.dispute.findUnique({ where: { id: query.cursor } })
        : null;
      if (query.cursor && !anchor)
        fail(400, 'INVALID_CURSOR', 'Dispute cursor not found.');
      const rows = await tx.dispute.findMany({
        where: {
          status: query.status,
          matchResult: query.gameId
            ? { match: { challenge: { gameId: query.gameId } } }
            : undefined,
          createdAt: {
            ...(query.createdAfter ? { gt: new Date(query.createdAfter) } : {}),
            ...(query.createdBefore
              ? { lt: new Date(query.createdBefore) }
              : {}),
          },
          ...(anchor
            ? {
                OR: [
                  { createdAt: { lt: anchor.createdAt } },
                  { createdAt: anchor.createdAt, id: { lt: anchor.id } },
                ],
              }
            : {}),
        },
        select: disputeSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      return {
        items: rows.slice(0, query.limit).map(present),
        nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null,
      };
    });
  }
  detail(id: string, actor: Identity) {
    return serializable(this.db, async (tx) => {
      await this.authorize(tx, actor);
      const row = await tx.dispute.findUnique({
        where: { id },
        select: disputeSelect,
      });
      if (!row) fail(404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
      const match = row.matchResult.match;
      await tx.match.update({
        where: { id: match.id },
        data: { updatedAt: new Date() },
      });
      await matchEvent(tx, match.id, 'DISPUTE_REVIEWED', actor.sub, {
        matchId: match.id,
        challengeId: match.challengeId,
        disputeId: id,
      });
      const { entryFee, ...challenge } = match.challenge;
      const auditEvents = await tx.auditLog.findMany({
        where: { entity: 'Match', entityId: match.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          action: true,
          userId: true,
          createdAt: true,
          metadata: true,
        },
      });
      return {
        ...present(row),
        match: {
          ...match,
          challenge: { ...challenge, stakeAmount: entryFee },
          settlement: settlementView(match),
        },
        timeline: await tx.matchEvent.findMany({
          where: { matchId: match.id },
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            sequence: true,
            type: true,
            actorUserId: true,
            createdAt: true,
          },
        }),
        auditEvents: auditEvents.map((e) => ({
          ...e,
          metadata:
            e.metadata &&
            typeof e.metadata === 'object' &&
            !Array.isArray(e.metadata)
              ? Object.fromEntries(
                  Object.entries(e.metadata).filter(
                    ([key, value]) =>
                      [
                        'matchId',
                        'challengeId',
                        'disputeId',
                        'resolution',
                      ].includes(key) && typeof value === 'string',
                  ),
                )
              : null,
        })),
      };
    });
  }
  resolve(id: string, actor: Identity, dto: ResolveDisputeDto) {
    return serializable(this.db, async (tx) => {
      await this.authorize(tx, actor);
      const row = await tx.dispute.findUnique({
        where: { id },
        select: disputeSelect,
      });
      if (!row) fail(404, 'DISPUTE_NOT_FOUND', 'Dispute not found.');
      const match = row.matchResult.match,
        result = match.results[0];
      await tx.match.update({
        where: { id: match.id },
        data: { updatedAt: new Date() },
      });
      if (
        !['OPEN', 'REVIEW'].includes(row.status) ||
        match.status !== 'DISPUTED' ||
        result?.status !== 'DISPUTED'
      )
        fail(
          409,
          'DISPUTE_ALREADY_RESOLVED',
          'Dispute is no longer open for resolution.',
        );
      if (match.participants.some((p) => p.userId === actor.sub))
        fail(
          403,
          'MODERATOR_CONFLICT',
          'Participants cannot moderate their own match.',
        );
      const a = match.participants.find(
        (p) => p.userId === match.challenge.createdByUserId,
      );
      const b = match.participants.find(
        (p) => p.userId !== match.challenge.createdByUserId,
      );
      if (!a || !b || match.participants.length !== 2)
        fail(409, 'INVALID_PARTICIPANTS', 'Two fixed participants required.');
      const winnerUserId =
        dto.resolution === 'VOID_MATCH'
          ? null
          : dto.resolution === 'PLAYER_A_WINS'
            ? a.userId
            : b.userId;
      await tx.dispute.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolution: dto.resolution,
          resolutionReason: dto.reason,
          resolvedByUserId: actor.sub,
          resolvedAt: new Date(),
        },
      });
      await tx.matchResult.update({
        where: { id: result.id },
        data: { status: 'RESOLVED', winnerUserId },
      });
      await matchEvent(tx, match.id, 'DISPUTE_RESOLVED', actor.sub, {
        matchId: match.id,
        challengeId: match.challengeId,
        disputeId: id,
        resolution: dto.resolution,
      });
      if (winnerUserId)
        await this.ledger.settleMatch(
          {
            matchId: match.id,
            winnerUserId,
            idempotencyKey: `match-settlement:${match.id}`,
            actorUserId: actor.sub,
          },
          tx,
        );
      else
        await this.ledger.refundMatch(
          { matchId: match.id, actorUserId: actor.sub },
          tx,
        );
      const final = await tx.match.findUniqueOrThrow({
        where: { id: match.id },
        select: matchSelect,
      });
      return {
        disputeId: id,
        resolution: dto.resolution,
        status: 'RESOLVED',
        settlement: settlementView(final),
      };
    });
  }
}
