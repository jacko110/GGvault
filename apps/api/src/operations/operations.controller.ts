import { Controller, Get, Header } from '@nestjs/common';
import { Roles } from '../auth/auth.guard';
import { PrismaService } from '../database/prisma.service';
import { HealthService } from '../health/health.service';
import { httpMetrics } from '../common/observability';

const productEvents = [
  'USER_REGISTERED',
  'GAME_ACCOUNT_ADDED',
  'CHALLENGE_CREATED',
  'CHALLENGE_JOINED',
  'CHALLENGE_FUNDED',
  'MATCH_STARTED',
  'RESULT_SUBMITTED',
  'RESULT_CONFIRMED',
  'DISPUTE_OPENED',
  'DISPUTE_RESOLVED',
  'MATCH_SETTLED',
  'MATCH_REFUNDED',
  'EVIDENCE_UPLOADED',
  'CHALLENGE_CANCELLED',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
];

/** No public metrics, finance internals or user-level analytics. */
@Controller('operations')
@Roles('ADMIN')
export class OperationsController {
  constructor(
    private readonly db: PrismaService,
    private readonly health: HealthService,
  ) {}
  @Get('summary')
  async summary() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [
      users,
      openChallenges,
      activeMatches,
      openDisputes,
      settlementsToday,
      refundsToday,
      health,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.challenge.count({ where: { status: 'OPEN' } }),
      this.db.match.count({
        where: {
          status: {
            in: ['READY', 'IN_PROGRESS', 'RESULT_SUBMITTED', 'DISPUTED'],
          },
        },
      }),
      this.db.dispute.count({ where: { status: { in: ['OPEN', 'REVIEW'] } } }),
      this.db.ledgerTransaction.count({
        where: { type: 'MATCH_SETTLEMENT', createdAt: { gte: today } },
      }),
      this.db.ledgerTransaction.count({
        where: { type: 'STAKE_REFUND', createdAt: { gte: today } },
      }),
      this.health
        .readiness()
        .catch(() => ({
          status: 'unavailable',
          api: 'up',
          postgresql: 'unknown',
          redis: 'unknown',
        })),
    ]);
    return {
      users,
      openChallenges,
      activeMatches,
      openDisputes,
      settlementsToday,
      refundsToday,
      health,
    };
  }
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics() {
    const groups = await this.db.auditLog.groupBy({
      by: ['action'],
      where: { action: { in: productEvents } },
      _count: true,
    });
    return (
      httpMetrics() +
      '# TYPE ggvault_product_events_total counter\n' +
      groups
        .map(
          (row) =>
            `ggvault_product_events_total{event="${row.action}"} ${row._count}`,
        )
        .join('\n') +
      '\n'
    );
  }
  @Get('funnel')
  async funnel() {
    const [
      registered,
      participants,
      funded,
      started,
      completed,
      challengeCount,
      cancelled,
      disputes,
      refunds,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.challengePlayer.findMany({
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.db.auditLog.findMany({
        where: { action: 'CHALLENGE_FUNDED', userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.db.matchParticipant.findMany({
        where: { match: { startedAt: { not: null } } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.db.matchParticipant.groupBy({
        by: ['userId'],
        where: { match: { status: { in: ['SETTLED', 'REFUNDED'] } } },
        _count: true,
      }),
      this.db.challenge.count(),
      this.db.challenge.count({ where: { status: 'CANCELLED' } }),
      this.db.dispute.count(),
      this.db.match.count({ where: { status: 'REFUNDED' } }),
    ]);
    const terminal = await this.db.match.count({
      where: { status: { in: ['SETTLED', 'REFUNDED'] } },
    });
    const matches = await this.db.match.count();
    const rate = (n: number, d: number) => (d ? n / d : 0);
    return {
      registered,
      participated: participants.length,
      funded: funded.length,
      started: started.length,
      completed: completed.length,
      repeatMatches: completed.filter((p) => p._count > 1).length,
      challengeCompletionRate: rate(terminal, challengeCount),
      cancellationRate: rate(cancelled, challengeCount),
      disputeRate: rate(disputes, matches),
      refundRate: rate(refunds, matches),
    };
  }
}
