import { Prisma } from '@prisma/client';
import { audit, fail } from '../common/domain';

export async function matchEvent(
  tx: Prisma.TransactionClient,
  matchId: string,
  type: string,
  actorUserId: string | null,
) {
  await tx.matchEvent.create({ data: { matchId, type, actorUserId } });
  await audit(tx, actorUserId, type, 'Match', matchId);
}

// Runs in the caller's funding transaction. Unique challengeId is the final duplicate barrier.
export async function ensureFundedMatch(
  tx: Prisma.TransactionClient,
  challengeId: string,
) {
  const existing = await tx.match.findUnique({ where: { challengeId } });
  if (existing) return existing;
  const challenge = await tx.challenge.findUniqueOrThrow({
    where: { id: challengeId },
    include: { players: true },
  });
  if (
    challenge.status !== 'FUNDED' ||
    challenge.players.length !== 2 ||
    challenge.players.some(
      (p) => p.status !== 'FUNDED' && p.status !== 'LOCKED',
    )
  ) {
    fail(
      409,
      'MATCH_REQUIRES_FUNDING',
      'Two funded participants are required.',
    );
  }
  const match = await tx.match.create({
    data: {
      challengeId,
      participants: {
        create: challenge.players.map((p) => ({ userId: p.userId })),
      },
    },
  });
  await matchEvent(tx, match.id, 'MATCH_CREATED', null);
  return match;
}
