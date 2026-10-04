import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { mkdir, readdir, unlink } from 'fs/promises';
import { join, resolve as resolvePath } from 'path';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/database/prisma.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { spawnSync } from 'child_process';

jest.setTimeout(60000);
type Player = { id: string; token: string };
describe('Phase 7 security and operations', () => {
  let app: INestApplication, db: PrismaService, ledger: LedgerService;
  let a: Player, b: Player, moderator: Player, admin: Player;
  let gameId: string, challengeId: string, matchId: string;
  const previousStorage = process.env.EVIDENCE_STORAGE_DIR;
  const previousFee = process.env.PLATFORM_FEE_BPS;
  const storage = resolvePath('storage', `phase7-tests-${randomUUID()}`);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',
    'base64',
  );
  const api = () => request(app.getHttpServer());
  const bearer = (p: Player) => `Bearer ${p.token}`;
  const post = (path: string, p: Player, body: object = {}) =>
    api().post(path).set('Authorization', bearer(p)).send(body);
  const get = (path: string, p: Player) =>
    api().get(path).set('Authorization', bearer(p));
  const confirm = () => post(`/matches/${matchId}/result/confirm`, b);
  const resolve = (id: string, resolution: string, actor = moderator) =>
    post(`/moderation/disputes/${id}/resolve`, actor, {
      resolution,
      reason: 'Evidence reviewed and decision recorded.',
    });
  const propose = (myScore = 4, opponentScore = 2) =>
    post(`/matches/${matchId}/result`, a, { myScore, opponentScore }).expect(
      201,
    );
  async function dispute() {
    await propose();
    await post(`/matches/${matchId}/result/dispute`, b, {
      reason: 'The proposed score is incorrect.',
    }).expect(200);
    return (await db.dispute.findFirstOrThrow()).id;
  }
  beforeAll(async () => {
    process.env.PLATFORM_FEE_BPS = '500';
    process.env.EVIDENCE_STORAGE_DIR = storage;
    await mkdir(storage, { recursive: true });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    ledger = app.get(LedgerService);
  });
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE users, games, ledger_transactions RESTART IDENTITY CASCADE',
    );
    const players: Player[] = [];
    for (const username of ['amir', 'samuel', 'moderator', 'admin']) {
      const user = await db.user.create({
        data: {
          username,
          email: `${username}@example.com`,
          role:
            username === 'moderator'
              ? 'MODERATOR'
              : username === 'admin'
                ? 'ADMIN'
                : 'USER',
        },
      });
      const session = await db.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      players.push({
        id: user.id,
        token: await app
          .get(JwtService)
          .signAsync({ sub: user.id, sessionId: session.id }),
      });
      if (username === 'amir' || username === 'samuel')
        await ledger.createInitialCredit({
          userId: user.id,
          amount: 100,
          idempotencyKey: `init:${user.id}`,
        });
    }
    [a, b, moderator, admin] = players;
    gameId = (await db.game.create({ data: { name: 'FC 26', slug: 'fc26' } }))
      .id;
    for (const p of [a, b])
      await db.gameAccount.create({
        data: { userId: p.id, gameId, platform: 'PS5', gamertag: p.id },
      });
    const created = await post('/challenges', a, {
      gameId,
      stakeAmount: 10,
      currency: 'TEST',
      platform: 'PS5',
      mode: '1v1',
    }).expect(201);
    challengeId = created.body.id;
    await post(`/challenges/${challengeId}/join`, b).expect(200);
    for (const p of [a, b])
      await post(`/challenges/${challengeId}/fund`, p)
        .set('Idempotency-Key', 'phase5-fund')
        .expect(200);
    matchId = (await db.match.findUniqueOrThrow({ where: { challengeId } })).id;
    for (const p of [a, b])
      await post(`/matches/${matchId}/ready`, p).expect(200);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (app) await app.close();
    for (const name of await readdir(storage))
      await unlink(join(storage, name));
    if (previousStorage === undefined) delete process.env.EVIDENCE_STORAGE_DIR;
    else process.env.EVIDENCE_STORAGE_DIR = previousStorage;
    if (previousFee === undefined) delete process.env.PLATFORM_FEE_BPS;
    else process.env.PLATFORM_FEE_BPS = previousFee;
  });

  it('denies an unrelated actor every private match action', async () => {
    const outsider = moderator;
    await db.user.update({
      where: { id: outsider.id },
      data: { role: 'USER' },
    });
    for (const suffix of ['', '/timeline', '/evidence', '/refunds'])
      await get('/matches/' + matchId + suffix, outsider).expect(403);
    for (const [suffix, body] of [
      ['ready', {}],
      ['result', { myScore: 4, opponentScore: 2 }],
      ['result/confirm', {}],
      ['result/dispute', { reason: 'Unrelated actor attempt' }],
    ] as const)
      await post('/matches/' + matchId + '/' + suffix, outsider, body).expect(
        403,
      );
    await post('/challenges/' + challengeId + '/fund', outsider)
      .set('Idempotency-Key', 'outsider-funding')
      .expect(403);
    await post('/challenges/' + challengeId + '/cancel', outsider).expect(403);
    for (const suffix of ['balance', 'ledger'])
      await get('/users/' + a.id + '/' + suffix, outsider).expect(403);
    expect(
      (await get('/users/me/transactions', outsider).expect(200)).body.items,
    ).toEqual([]);
  });
  it('rejects mass assignment of profile ownership and finance authority', async () => {
    await api()
      .patch('/users/me')
      .set('Authorization', bearer(a))
      .send({ userId: b.id, role: 'ADMIN' })
      .expect(400);
    for (const body of [
      { userId: b.id },
      { ledgerAccountId: 'arbitrary' },
      { amount: 99999 },
      { balance: 99999 },
    ])
      await post('/challenges/' + challengeId + '/fund', a, body)
        .set('Idempotency-Key', 'injected-funding')
        .expect(400);
    for (const body of [
      { winnerUserId: a.id },
      { platformFee: 0 },
      { payout: 999999 },
    ])
      await post('/matches/' + matchId + '/result', a, {
        myScore: 4,
        opponentScore: 2,
        ...body,
      }).expect(400);
    for (const path of [
      '/ledger/entries',
      '/matches/' + matchId + '/settle',
      '/matches/' + matchId + '/refund',
    ])
      await post(path, a).expect(404);
  });
  it.each(['SUSPENDED', 'BANNED'] as const)(
    'denies inactive actor %s',
    async (status) => {
      await db.user.update({ where: { id: a.id }, data: { status } });
      await get('/matches/' + matchId, a).expect(403);
      await post('/matches/' + matchId + '/ready', a).expect(403);
    },
  );
  it('protects operations from users and moderators, exposes safe admin summaries', async () => {
    for (const actor of [a, moderator])
      for (const route of ['summary', 'metrics', 'funnel'])
        await get('/operations/' + route, actor).expect(403);
    const summary = await get('/operations/summary', admin).expect(200);
    expect(summary.body).toMatchObject({
      users: 4,
      activeMatches: 1,
      health: { status: 'ok' },
    });
    const funnel = await get('/operations/funnel', admin).expect(200);
    expect(funnel.body).toMatchObject({
      registered: 4,
      participated: 2,
      funded: 2,
      started: 2,
    });
    const metrics = await get('/operations/metrics', admin).expect(200);
    expect(metrics.text).toContain('ggvault_http_requests_total');
    expect(metrics.text).toContain('CHALLENGE_FUNDED');
    expect(metrics.text).not.toContain(a.id);
  });
  it('returns safe readiness and correlated errors', async () => {
    await api().get('/health/live').expect(200);
    await api().get('/health/ready').expect(200);
    const denied = await api()
      .get('/matches/' + matchId)
      .set('X-Request-ID', 'malicious')
      .expect(401);
    expect(denied.body.requestId).toBe(denied.headers['x-request-id']);
    expect(denied.body.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(denied.body)).not.toMatch(
      /password|Prisma|SELECT|stack/,
    );
  });
  it('operational CLI detects independently unbalanced transactions even when global sum is zero', async () => {
    const account = await db.ledgerAccount.findFirstOrThrow({
      where: { userId: a.id, accountType: 'USER_AVAILABLE' },
    });
    // Deliberate corruption of disposable test fixtures, never an application repair path.
    for (const direction of ['CREDIT', 'DEBIT'] as const)
      await db.ledgerTransaction.create({
        data: {
          type: 'ADMIN_ADJUSTMENT',
          idempotencyKey: randomUUID(),
          entries: {
            create: { ledgerAccountId: account.id, direction, amount: 1 },
          },
        },
      });
    const result = spawnSync(
      process.execPath,
      ['scripts/ledger-invariants.cjs'],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout.trim());
    expect(report).toMatchObject({
      level: 'CRITICAL',
      ok: false,
      globalConservation: '0',
      invalidTransactions: 2,
    });
    expect(
      await db.ledgerTransaction.count({ where: { type: 'ADMIN_ADJUSTMENT' } }),
    ).toBe(2);
  });
  it('deduplicates repeated and concurrent moderator review reads', async () => {
    const id = await dispute();
    await Promise.all(
      Array.from({ length: 4 }, () =>
        get('/moderation/disputes/' + id, moderator).expect(200),
      ),
    );
    expect(
      await db.matchEvent.count({
        where: { matchId, type: 'DISPUTE_REVIEWED', actorUserId: moderator.id },
      }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: {
          entityId: matchId,
          action: 'DISPUTE_REVIEWED',
          userId: moderator.id,
        },
      }),
    ).toBe(1);
  });
  it('limits mutations across changing identifiers and ignores spoofed forwarding IP', async () => {
    let limited = false;
    for (let i = 0; i < 65; i++) {
      const response = await post('/matches/' + matchId + '/ready', a).set(
        'X-Forwarded-For',
        '192.0.2.' + i,
      );
      if (response.status === 429) {
        expect(response.body.code).toBe('RATE_LIMITED');
        expect(response.headers['retry-after']).toBe('60');
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
    await post('/matches/' + matchId + '/ready', b).expect(200);
  });
  it('bounds multipart field names and keeps the process available', async () => {
    await api()
      .post(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(a))
      .field('x'.repeat(33), 'SCREENSHOT')
      .attach('file', png, { filename: 'score.png', contentType: 'image/png' })
      .expect(400);
    await api().get('/health/live').expect(200);
  });
  it('limits moderator mutations to ten per minute even when requests are invalid', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await post(
        `/moderation/disputes/${matchId}/resolve`,
        moderator,
        {},
      );
      expect(response.status).toBe(400);
    }
    const limited = await post(
      `/moderation/disputes/${matchId}/resolve`,
      moderator,
      {},
    );
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('RATE_LIMITED');
  });
  it('enforces beta stake/open/daily limits inside creation transaction', async () => {
    const previous = { ...process.env };
    try {
      process.env.BETA_MODE = 'true';
      process.env.MAX_STAKE_TEST_CREDITS = '20';
      process.env.MAX_OPEN_CHALLENGES_PER_USER = '1';
      process.env.MAX_DAILY_CHALLENGES = '2';
      const body = {
        gameId,
        stakeAmount: 21,
        currency: 'TEST',
        platform: 'PS5',
        mode: '1v1',
      };
      expect((await post('/challenges', a, body).expect(400)).body.code).toBe(
        'BETA_STAKE_LIMIT',
      );
      body.stakeAmount = 10;
      const results = await Promise.all([
        post('/challenges', a, body),
        post('/challenges', a, body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const created = results.find((r) => r.status === 201)!.body.id;
      await post('/challenges/' + created + '/cancel', a).expect(200);
      expect((await post('/challenges', a, body).expect(429)).body.code).toBe(
        'BETA_DAILY_CHALLENGE_LIMIT',
      );
    } finally {
      process.env = previous;
    }
  });
});
