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

jest.setTimeout(60000);
type Player = { id: string; token: string };
describe('Phase 5 real PostgreSQL settlement and moderation', () => {
  let app: INestApplication, db: PrismaService, ledger: LedgerService;
  let a: Player, b: Player, moderator: Player, admin: Player;
  let gameId: string, challengeId: string, matchId: string;
  const previousStorage = process.env.EVIDENCE_STORAGE_DIR;
  const previousFee = process.env.PLATFORM_FEE_BPS;
  const storage = resolvePath('storage', `phase5-tests-${randomUUID()}`);
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
  it('lists only owned matches and validates safe read filters', async () => {
    await api().get('/matches').expect(401);
    const own = await get('/matches?status=IN_PROGRESS&limit=1', a).expect(200);
    expect(own.body.items.map((m: { id: string }) => m.id)).toEqual([matchId]);
    expect(own.body.items[0]).toMatchObject({
      game: 'FC 26',
      stakeAmount: 10,
      players: expect.arrayContaining(['amir', 'samuel']),
    });
    expect((await get('/matches', moderator).expect(200)).body.items).toEqual(
      [],
    );
    await get('/matches?status=BOGUS', a).expect(400);
    await get('/matches?limit=101', a).expect(400);
    await get(`/matches/${matchId}/refunds`, a).expect(200, []);
  });
  it('returns exact posted refund credits without ledger internals', async () => {
    const id = await dispute();
    await resolve(id, 'VOID_MATCH').expect(200);
    const refunds = (await get(`/matches/${matchId}/refunds`, b).expect(200))
      .body;
    expect(refunds).toEqual(
      expect.arrayContaining([
        { userId: a.id, amount: 10 },
        { userId: b.id, amount: 10 },
      ]),
    );
    expect(refunds).toHaveLength(2);
    expect(Object.keys(refunds[0]).sort()).toEqual(['amount', 'userId']);
    expect(
      (await get(`/matches/${matchId}/refunds`, moderator).expect(200)).body,
    ).toEqual(refunds);
    await db.user.update({
      where: { id: moderator.id },
      data: { role: 'USER' },
    });
    await get(`/matches/${matchId}/refunds`, moderator).expect(403);
    await get(`/matches/${matchId}/refunds`, {
      ...admin,
      id: a.id,
      token: '',
    }).expect(401);
  });
  async function conservation() {
    const txs = await db.ledgerTransaction.findMany({
      include: { entries: true },
    });
    let global = 0;
    for (const tx of txs) {
      const sum = tx.entries.reduce(
        (s, e) => s + (e.direction === 'CREDIT' ? e.amount : -e.amount),
        0,
      );
      expect(sum).toBe(0);
      expect(tx.entries.every((e) => e.amount > 0)).toBe(true);
      global += sum;
    }
    expect(global).toBe(0);
  }
  async function balances(
    amir: number,
    samuel: number,
    vault: number,
    platform: number,
  ) {
    expect((await ledger.getUserBalance(a.id)).balance).toBe(amir);
    expect((await ledger.getUserBalance(b.id)).balance).toBe(samuel);
    expect((await ledger.getChallengeVault(challengeId)).balance).toBe(vault);
    const entries = await db.ledgerEntry.findMany({
      where: { ledgerAccount: { accountType: 'PLATFORM_REVENUE' } },
    });
    expect(
      entries.reduce(
        (s, e) => s + (e.direction === 'CREDIT' ? e.amount : -e.amount),
        0,
      ),
    ).toBe(platform);
    await conservation();
  }
  async function states(status: 'SETTLED' | 'REFUNDED' | 'DISPUTED') {
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: matchId } })).status,
    ).toBe(status);
    expect(
      (await db.challenge.findUniqueOrThrow({ where: { id: challengeId } }))
        .status,
    ).toBe(status);
    expect(
      (await db.matchResult.findUniqueOrThrow({ where: { matchId } })).status,
    ).toBe(status);
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

  it.each([true, false])(
    'confirmed settlement pays correct winner (Amir=%s)',
    async (amirWins) => {
      await balances(90, 90, 20, 0);
      await propose(amirWins ? 4 : 1, 2);
      const response = await confirm().expect(200);
      expect(response.body.settlement).toEqual({
        matchId,
        status: 'SETTLED',
        winner: {
          id: amirWins ? a.id : b.id,
          username: amirWins ? 'amir' : 'samuel',
        },
        vaultAmount: 20,
        winnerAmount: 19,
        platformFee: 1,
      });
      await balances(amirWins ? 109 : 90, amirWins ? 90 : 109, 0, 1);
      await states('SETTLED');
      const room = await get(`/matches/${matchId}`, a).expect(200);
      expect(room.body.settlement).toEqual(response.body.settlement);
      expect(room.body.vault).toEqual({ balance: 0, status: 'SETTLED' });
      expect(room.body.results[0].myScore).toBe(amirWins ? 4 : 1);
      const actions = (
        await db.auditLog.findMany({ where: { entityId: matchId } })
      ).map((e) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'RESULT_CONFIRMED',
          'SETTLEMENT_STARTED',
          'MATCH_SETTLED',
        ]),
      );
    },
  );
  it('concurrent confirmations and worker retries pay exactly once', async () => {
    await propose();
    const responses = await Promise.all([confirm(), confirm(), confirm()]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    const retries = await Promise.allSettled([
      ledger.settleMatch({
        matchId,
        winnerUserId: a.id,
        idempotencyKey: 'worker1',
      }),
      ledger.settleMatch({
        matchId,
        winnerUserId: a.id,
        idempotencyKey: 'worker2',
      }),
    ]);
    expect(retries.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(
      await db.ledgerTransaction.count({
        where: { matchId, type: 'MATCH_SETTLEMENT' },
      }),
    ).toBe(1);
    expect(
      await db.matchEvent.count({ where: { matchId, type: 'MATCH_SETTLED' } }),
    ).toBe(1);
    await balances(109, 90, 0, 1);
    await expect(
      ledger.settleMatch({
        matchId,
        winnerUserId: b.id,
        idempotencyKey: 'wrong-winner',
      }),
    ).rejects.toThrow();
  });
  it('dispute freezes all credits and rejects direct worker settlement', async () => {
    await dispute();
    await states('DISPUTED');
    await balances(90, 90, 20, 0);
    await expect(
      ledger.settleMatch({
        matchId,
        winnerUserId: a.id,
        idempotencyKey: 'bypass',
      }),
    ).rejects.toThrow();
    await expect(ledger.refundMatch({ matchId })).rejects.toThrow();
    expect(await db.ledgerTransaction.count({ where: { matchId } })).toBe(0);
  });
  it.each(['PLAYER_A_WINS', 'PLAYER_B_WINS', 'VOID_MATCH'])(
    'moderator resolution %s has exact atomic outcome',
    async (resolution) => {
      const id = await dispute();
      const response = await resolve(id, resolution).expect(200);
      const voided = resolution === 'VOID_MATCH';
      expect(response.body.status).toBe('RESOLVED');
      await states(voided ? 'REFUNDED' : 'SETTLED');
      await balances(
        voided ? 100 : resolution === 'PLAYER_A_WINS' ? 109 : 90,
        voided ? 100 : resolution === 'PLAYER_B_WINS' ? 109 : 90,
        0,
        voided ? 0 : 1,
      );
      const row = await db.dispute.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        status: 'RESOLVED',
        resolution,
        resolvedByUserId: moderator.id,
        resolutionReason: 'Evidence reviewed and decision recorded.',
      });
      expect(row.resolvedAt).not.toBeNull();
      expect(
        await db.ledgerTransaction.count({
          where: { matchId, type: 'MATCH_SETTLEMENT' },
        }),
      ).toBe(voided ? 0 : 1);
      expect(
        await db.ledgerTransaction.count({
          where: { matchId, type: 'STAKE_REFUND' },
        }),
      ).toBe(voided ? 1 : 0);
      await resolve(id, resolution).expect(409);
      await confirm().expect(409);
      await post(`/matches/${matchId}/result`, a, {
        myScore: 99,
        opponentScore: 0,
      }).expect(409);
      const room = await get(`/matches/${matchId}`, b).expect(200);
      expect(room.body.settlement.status).toBe(voided ? 'REFUNDED' : 'SETTLED');
      if (voided) expect(room.body.settlement.winner).toBeNull();
      // The database also rejects a contradictory outcome even when bypassing the service.
      await expect(
        db.ledgerTransaction.create({
          data: {
            matchId,
            type: voided ? 'MATCH_SETTLEMENT' : 'STAKE_REFUND',
            idempotencyKey: 'contradiction',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    },
  );
  it('void worker retries refund the recorded original stakes once', async () => {
    const id = await dispute();
    // A later nominal stake change must not determine the refund amount.
    await db.challenge.update({
      where: { id: challengeId },
      data: { entryFee: 42 },
    });
    await resolve(id, 'VOID_MATCH').expect(200);
    const retries = await Promise.allSettled([
      ledger.refundMatch({ matchId }),
      ledger.refundMatch({ matchId }),
    ]);
    expect(retries.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(
      await db.ledgerTransaction.count({
        where: { matchId, type: 'STAKE_REFUND' },
      }),
    ).toBe(1);
    await balances(100, 100, 0, 0);
  });
  it.each(['PLAYER_B_WINS', 'VOID_MATCH'])(
    'two moderators racing A against %s commit exactly one decision',
    async (alternative) => {
      const id = await dispute();
      const decision = async (choice: string, actor: Player) => {
        const response = await resolve(id, choice, actor);
        expect([200, 409]).toContain(response.status);
        if (response.status === 409) throw new Error('resolution conflict');
        return response;
      };
      const results = await Promise.allSettled([
        decision('PLAYER_A_WINS', moderator),
        decision(alternative, admin),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find(
        (r) => r.status === 'rejected',
      ) as PromiseRejectedResult;
      expect(failure.reason.message).toBe('resolution conflict');
      const row = await db.dispute.findUniqueOrThrow({ where: { id } });
      expect(['PLAYER_A_WINS', alternative]).toContain(row.resolution);
      const voided = row.resolution === 'VOID_MATCH';
      await balances(
        voided ? 100 : row.resolution === 'PLAYER_A_WINS' ? 109 : 90,
        voided ? 100 : row.resolution === 'PLAYER_B_WINS' ? 109 : 90,
        0,
        voided ? 0 : 1,
      );
      expect(await db.ledgerTransaction.count({ where: { matchId } })).toBe(1);
      expect(
        await db.matchEvent.count({
          where: { matchId, type: 'DISPUTE_RESOLVED' },
        }),
      ).toBe(1);
    },
  );
  it('resolution racing a stale settlement worker cannot bypass dispute', async () => {
    const id = await dispute();
    const results = await Promise.allSettled([
      resolve(id, 'VOID_MATCH').expect(200),
      ledger.settleMatch({
        matchId,
        winnerUserId: a.id,
        idempotencyKey: 'stale-worker',
      }),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    await balances(100, 100, 0, 0);
  });
  it('financial failure rolls back confirmation, ledger and audit together', async () => {
    await propose();
    const original = ledger.settleMatch.bind(ledger);
    jest.spyOn(ledger, 'settleMatch').mockImplementation(async (...args) => {
      await original(...args);
      throw new Error('simulated post-ledger failure');
    });
    await confirm().expect(500);
    expect(
      (await db.matchResult.findUniqueOrThrow({ where: { matchId } })).status,
    ).toBe('PENDING');
    expect(await db.ledgerTransaction.count({ where: { matchId } })).toBe(0);
    expect(
      await db.auditLog.count({ where: { action: 'MATCH_SETTLED' } }),
    ).toBe(0);
    await balances(90, 90, 20, 0);
  });
  it('refund failure rolls back moderator decision and all entries', async () => {
    const id = await dispute(),
      original = ledger.refundMatch.bind(ledger);
    jest.spyOn(ledger, 'refundMatch').mockImplementation(async (...args) => {
      await original(...args);
      throw new Error('simulated post-refund failure');
    });
    await resolve(id, 'VOID_MATCH').expect(500);
    expect(
      (await db.dispute.findUniqueOrThrow({ where: { id } })).resolution,
    ).toBeNull();
    await states('DISPUTED');
    await balances(90, 90, 20, 0);
    expect(await db.ledgerTransaction.count({ where: { matchId } })).toBe(0);
  });
  it('users cannot list, inspect or resolve disputes; moderator and admin can read', async () => {
    const id = await dispute();
    for (const p of [a, b]) {
      await get('/moderation/disputes', p).expect(403);
      await get(`/moderation/disputes/${id}`, p).expect(403);
      await resolve(id, 'PLAYER_A_WINS', p).expect(403);
    }
    await api().get('/moderation/disputes').expect(401);
    for (const p of [moderator, admin]) {
      await get('/moderation/disputes', p).expect(200);
      const detail = await get(`/moderation/disputes/${id}`, p).expect(200);
      expect(detail.body.players).toEqual(
        expect.arrayContaining([
          { id: a.id, username: 'amir', slot: 'PLAYER_A' },
          { id: b.id, username: 'samuel', slot: 'PLAYER_B' },
        ]),
      );
      expect(detail.body.proposedResult.proposedWinnerUserId).toBe(a.id);
      expect(
        detail.body.auditEvents.some(
          (e: { action: string }) => e.action === 'DISPUTE_REVIEWED',
        ),
      ).toBe(true);
      expect(JSON.stringify(detail.body)).not.toMatch(
        /password|refreshToken|email|objectKey|ledgerAccountId/,
      );
    }
  });
  it('queue filters, cursors, limits and dates are enforced', async () => {
    const id = await dispute();
    expect(
      (
        await get(
          `/moderation/disputes?status=REVIEW&gameId=${gameId}&limit=1`,
          moderator,
        ).expect(200)
      ).body.items[0].id,
    ).toBe(id);
    for (const query of [
      'status=RESOLVED',
      'gameId=other',
      'createdBefore=2000-01-01T00:00:00Z',
      'createdAfter=2099-01-01T00:00:00Z',
      `cursor=${id}`,
    ])
      expect(
        (await get(`/moderation/disputes?${query}`, moderator).expect(200)).body
          .items,
      ).toEqual([]);
    for (const query of [
      'limit=101',
      'status=FAKE',
      'createdAfter=bad',
      'cursor=missing',
      'createdAfter=2026-01-02&createdBefore=2026-01-01',
    ])
      await get(`/moderation/disputes?${query}`, moderator).expect(400);
  });
  it.each([
    'winnerUserId',
    'platformFee',
    'winnerAmount',
    'payoutAmount',
    'destinationAccount',
    'status',
  ])('rejects client financial field %s', async (field) => {
    const id = await dispute();
    await post(`/moderation/disputes/${id}/resolve`, moderator, {
      resolution: 'PLAYER_A_WINS',
      reason: 'Evidence verified',
      [field]: a.id,
    }).expect(400);
    expect(await db.ledgerTransaction.count({ where: { matchId } })).toBe(0);
  });
  it('requires valid resolution and nonblank moderator reason', async () => {
    const id = await dispute();
    for (const body of [
      { resolution: 'PLAYER_A_WINS' },
      { resolution: 'PLAYER_A_WINS', reason: '   ' },
      { resolution: 'ARBITRARY', reason: 'Evidence reviewed' },
    ])
      await post(`/moderation/disputes/${id}/resolve`, moderator, body).expect(
        400,
      );
  });
  it('fresh role checks block revoked moderator privileges and self-moderation', async () => {
    const id = await dispute();
    await db.user.update({
      where: { id: moderator.id },
      data: { role: 'USER' },
    });
    await resolve(id, 'PLAYER_A_WINS').expect(403);
    await db.user.update({ where: { id: a.id }, data: { role: 'MODERATOR' } });
    await resolve(id, 'PLAYER_A_WINS', a).expect(403);
  });
  it('safe history returns signed owned entries and pagination', async () => {
    await propose();
    await confirm().expect(200);
    const history = await get('/users/me/transactions', a).expect(200);
    expect(
      history.body.items.map((e: { type: string; amount: number }) => [
        e.type,
        e.amount,
      ]),
    ).toEqual([
      ['MATCH_WIN', 19],
      ['STAKE_LOCK', -10],
      ['INITIAL_CREDIT', 100],
    ]);
    expect(history.body.items[0]).toMatchObject({ challengeId, matchId });
    expect(JSON.stringify(history.body)).not.toMatch(
      /ledgerAccount|direction|entries|password/,
    );
    const first = await get('/users/me/transactions?limit=1', a).expect(200);
    const second = await get(
      `/users/me/transactions?limit=1&cursor=${first.body.nextCursor}`,
      a,
    ).expect(200);
    expect(second.body.items[0].type).toBe('STAKE_LOCK');
    await get(
      `/users/me/transactions?cursor=${first.body.nextCursor}`,
      b,
    ).expect(400);
    await get('/users/me/transactions?userId=other', a).expect(400);
  });
  it('refund history includes original positive stake', async () => {
    const id = await dispute();
    await resolve(id, 'VOID_MATCH').expect(200);
    for (const p of [a, b])
      expect(
        (await get('/users/me/transactions', p).expect(200)).body.items[0],
      ).toMatchObject({
        type: 'STAKE_REFUND',
        amount: 10,
        matchId,
        challengeId,
      });
  });
  it('no player settlement or raw status endpoints exist', async () => {
    await post(`/matches/${matchId}/settle`, a).expect(404);
    await api()
      .patch(`/matches/${matchId}`)
      .set('Authorization', bearer(a))
      .send({ status: 'SETTLED' })
      .expect(404);
    await propose();
    await post(`/matches/${matchId}/result/confirm`, b, {
      platformFee: 0,
    }).expect(400);
  });
  it('resumes an existing Phase 4 confirmation exactly once', async () => {
    await propose();
    await db.matchResult.update({
      where: { matchId },
      data: {
        status: 'CONFIRMED',
        confirmedByUserId: b.id,
        confirmedAt: new Date(),
      },
    });
    await db.match.update({
      where: { id: matchId },
      data: { status: 'CONFIRMED' },
    });
    await db.challenge.update({
      where: { id: challengeId },
      data: { status: 'CONFIRMED' },
    });
    await confirm().expect(200);
    await confirm().expect(200);
    await states('SETTLED');
    await balances(109, 90, 0, 1);
    expect(
      await db.ledgerTransaction.count({
        where: { matchId, type: 'MATCH_SETTLEMENT' },
      }),
    ).toBe(1);
  });
  it('player slots do not depend on which participant submitted the score', async () => {
    await post(`/matches/${matchId}/result`, b, {
      myScore: 4,
      opponentScore: 2,
    }).expect(201);
    await post(`/matches/${matchId}/result/dispute`, a, {
      reason: 'The score is incorrect.',
    }).expect(200);
    const id = (await db.dispute.findFirstOrThrow()).id;
    await resolve(id, 'PLAYER_A_WINS', admin).expect(200);
    await balances(109, 90, 0, 1);
    const detail = await get(`/moderation/disputes/${id}`, moderator).expect(
      200,
    );
    expect(detail.body.proposedResult.proposedWinnerUserId).toBe(b.id);
    expect(detail.body.match.settlement.winner.id).toBe(a.id);
  });
  it('staff evidence review stays private and uploads remain closed after void', async () => {
    const uploaded = await api()
      .post(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(a))
      .field('type', 'SCREENSHOT')
      .attach('file', png, 'score.png')
      .expect(201);
    const id = await dispute();
    const detail = await get(`/moderation/disputes/${id}`, moderator).expect(
      200,
    );
    expect(detail.body.evidence[0].id).toBe(uploaded.body.id);
    const content = await get(
      `/matches/${matchId}/evidence/${uploaded.body.id}/content`,
      moderator,
    ).expect(200);
    expect(content.body).toEqual(png);
    expect(content.headers['cache-control']).toContain('no-store');
    await api()
      .get(`/matches/${matchId}/evidence/${uploaded.body.id}/content`)
      .expect(401);
    await resolve(id, 'VOID_MATCH').expect(200);
    await api()
      .post(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(b))
      .field('type', 'SCREENSHOT')
      .attach('file', png, 'later.png')
      .expect(409);
    await get(
      `/matches/${matchId}/evidence/${uploaded.body.id}/content`,
      admin,
    ).expect(200);
  });
  it('audit detail strips unexpected sensitive metadata', async () => {
    const id = await dispute();
    await db.auditLog.create({
      data: {
        entity: 'Match',
        entityId: matchId,
        action: 'TEST_EVENT',
        metadata: {
          matchId,
          refreshToken: 'test-value',
          privateData: 'hidden',
        },
      },
    });
    const detail = await get(`/moderation/disputes/${id}`, moderator).expect(
      200,
    );
    expect(JSON.stringify(detail.body)).not.toMatch(
      /refreshToken|test-value|privateData|hidden/,
    );
  });
  it('OpenAPI includes moderation and safe history response schemas', async () => {
    const docs = await api().get('/docs-json').expect(200);
    expect(docs.body.info.version).toBe('0.5');
    for (const path of [
      '/moderation/disputes',
      '/moderation/disputes/{id}',
      '/moderation/disputes/{id}/resolve',
      '/users/me/transactions',
    ])
      expect(docs.body.paths[path]).toBeDefined();
    expect(
      docs.body.components.schemas.SettlementResponse.properties.platformFee,
    ).toBeDefined();
    expect(
      docs.body.components.schemas.ResolutionResponse.properties.settlement,
    ).toBeDefined();
  });
});
