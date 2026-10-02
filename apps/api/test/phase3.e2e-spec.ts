import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createClient } from 'redis';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/database/prisma.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { tokenHash } from '../src/auth/auth.service';
import { ChallengesService } from '../src/challenges/challenges.service';

jest.setTimeout(60000);
interface Tokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; username: string };
}
describe('Phase 3 API with real PostgreSQL, Redis and LedgerService', () => {
  let app: INestApplication;
  let db: PrismaService;
  let ledger: LedgerService;
  const redis = createClient({ url: process.env.REDIS_URL });
  let amir: Tokens, samuel: Tokens, third: Tokens;
  let gameId: string, challengeId: string;
  const password = 'correct horse battery staple';
  const auth = (token: string) => `Bearer ${token}`;
  const api = () => request(app.getHttpServer());
  const create = (extra: Record<string, unknown> = {}) =>
    api()
      .post('/challenges')
      .set('Authorization', auth(amir.accessToken))
      .send({
        gameId,
        stakeAmount: 10,
        currency: 'TEST',
        platform: 'PS5',
        mode: '1v1',
        ...extra,
      });
  const action = (
    id: string,
    verb: string,
    user = amir,
    body: Record<string, unknown> = {},
    key = 'fund-operation-001',
  ) =>
    api()
      .post(`/challenges/${id}/${verb}`)
      .set('Authorization', auth(user.accessToken))
      .set('Idempotency-Key', key)
      .send(body);
  const join = (id: string, user = samuel) => action(id, 'join', user);
  const register = async (username: string): Promise<Tokens> => {
    const res = await api()
      .post('/auth/register')
      .send({ email: `${username}@example.com`, username, password })
      .expect(201);
    return res.body as Tokens;
  };
  beforeAll(async () => {
    process.env.ENABLE_TEST_CREDITS = 'true';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    ledger = app.get(LedgerService);
    await redis.connect();
  });
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE users, games, ledger_transactions RESTART IDENTITY CASCADE',
    );
    // Dedicated clean test Redis only; remove this suite's auth-rate keys, never unrelated keys.
    for await (const key of redis.scanIterator({ MATCH: 'auth-rate:*' }))
      await redis.del(key);
    amir = await register('amir');
    samuel = await register('samuel');
    third = await register('third');
    const game = await db.game.create({
      data: { slug: 'fc-26', name: 'FC 26' },
    });
    gameId = game.id;
    for (const user of [amir, samuel, third])
      await api()
        .post('/users/me/game-accounts')
        .set('Authorization', auth(user.accessToken))
        .send({ gameId, platform: 'PS5', gamertag: user.user.username })
        .expect(201);
    challengeId = (await create().expect(201)).body.id as string;
  });
  afterAll(async () => {
    if (redis.isOpen) await redis.quit();
    if (app) await app.close();
  });

  it('exposes only enabled public game fields to authenticated players', async () => {
    await db.game.create({
      data: { slug: 'disabled-arena', name: 'Disabled', enabled: false },
    });
    await api().get('/games').expect(401);
    const response = await api()
      .get('/games')
      .set('Authorization', auth(amir.accessToken))
      .expect(200);
    expect(response.body).toEqual([
      { id: gameId, name: 'FC 26', slug: 'fc-26' },
    ]);
  });

  it('registers normalized identities, hashes passwords and grants 100 credits through the ledger', async () => {
    const res = await api()
      .post('/auth/register')
      .send({ email: '  NEW@Example.com ', username: 'New_User', password })
      .expect(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.user.username).toBe('new_user');
    const stored = await db.user.findUniqueOrThrow({
      where: { id: res.body.user.id as string },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(password);
    expect(JSON.stringify(res.body)).not.toMatch(
      /passwordHash|refreshTokenHash/,
    );
    expect((await ledger.getUserBalance(stored.id)).balance).toBe(100);
    const session = await db.session.findUniqueOrThrow({
      where: { refreshTokenHash: tokenHash(res.body.refreshToken as string) },
    });
    expect(session.refreshTokenHash).not.toBe(res.body.refreshToken);
  });
  it.each([
    ['email', 'USER_EMAIL_EXISTS'],
    ['username', 'USER_USERNAME_EXISTS'],
  ])('rejects duplicate %s', async (field, code) => {
    const res = await api()
      .post('/auth/register')
      .send({
        email: 'other@example.com',
        username: 'other',
        password,
        [field]: field === 'email' ? 'AMIR@example.com' : 'AMIR',
      })
      .expect(409);
    expect(res.body.code).toBe(code);
  });
  it('handles simultaneous duplicate registration atomically', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        api()
          .post('/auth/register')
          .send({ email: 'race@example.com', username: 'race', password }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const user = await db.user.findUniqueOrThrow({
      where: { email: 'race@example.com' },
    });
    expect((await ledger.getUserBalance(user.id)).balance).toBe(100);
  });
  it('allows automatic credits to be disabled', async () => {
    process.env.ENABLE_TEST_CREDITS = 'false';
    try {
      const user = await register('nocredits');
      expect((await ledger.getUserBalance(user.user.id)).balance).toBe(0);
    } finally {
      process.env.ENABLE_TEST_CREDITS = 'true';
    }
  });
  it('logs in and serves current user without hashes', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ email: 'amir@example.com', password })
      .expect(200);
    const me = await api()
      .get('/auth/me')
      .set('Authorization', auth(res.body.accessToken as string))
      .expect(200);
    expect(me.body.id).toBe(amir.user.id);
    expect(JSON.stringify(me.body)).not.toMatch(
      /password|refreshToken|sessions/,
    );
    const claims = JSON.parse(
      Buffer.from(
        (res.body.accessToken as string).split('.')[1],
        'base64url',
      ).toString(),
    ) as Record<string, unknown>;
    expect(Object.keys(claims).sort()).toEqual([
      'aud',
      'exp',
      'iat',
      'iss',
      'role',
      'sessionId',
      'sub',
    ]);
    expect(Number(claims.exp) - Number(claims.iat)).toBe(900);
  });
  it('rejects wrong passwords and unauthenticated me', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ email: 'amir@example.com', password: 'incorrect password' })
      .expect(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    await api().get('/auth/me').expect(401);
  });
  it('rotates refresh tokens, rejects reuse and revokes the old access session', async () => {
    const res = await api()
      .post('/auth/refresh')
      .send({ refreshToken: amir.refreshToken })
      .expect(200);
    expect(res.body.refreshToken).not.toBe(amir.refreshToken);
    await api()
      .post('/auth/refresh')
      .send({ refreshToken: amir.refreshToken })
      .expect(401);
    await api()
      .get('/auth/me')
      .set('Authorization', auth(amir.accessToken))
      .expect(401);
    await api()
      .get('/auth/me')
      .set('Authorization', auth(res.body.accessToken as string))
      .expect(200);
  });
  it('permits exactly one concurrent refresh', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        api().post('/auth/refresh').send({ refreshToken: amir.refreshToken }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });
  it('logout rejects both access and refresh tokens', async () => {
    await api()
      .post('/auth/logout')
      .set('Authorization', auth(amir.accessToken))
      .send({})
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', auth(amir.accessToken))
      .expect(401);
    await api()
      .post('/auth/refresh')
      .send({ refreshToken: amir.refreshToken })
      .expect(401);
  });
  it('rejects expired sessions', async () => {
    await db.session.updateMany({
      where: { userId: amir.user.id },
      data: { expiresAt: new Date(0) },
    });
    const res = await api()
      .post('/auth/refresh')
      .send({ refreshToken: amir.refreshToken })
      .expect(401);
    expect(res.body.code).toBe('AUTH_SESSION_EXPIRED');
  });
  it('enforces roles using current database role', async () => {
    await api()
      .get('/auth/moderation-access')
      .set('Authorization', auth(amir.accessToken))
      .expect(403);
    await db.user.update({
      where: { id: amir.user.id },
      data: { role: 'ADMIN' },
    });
    await api()
      .get('/auth/moderation-access')
      .set('Authorization', auth(amir.accessToken))
      .expect(200);
    await db.user.update({
      where: { id: amir.user.id },
      data: { role: 'MODERATOR' },
    });
    await api()
      .get('/auth/moderation-access')
      .set('Authorization', auth(amir.accessToken))
      .expect(200);
  });
  it.each(['SUSPENDED', 'BANNED', 'DELETED'] as const)(
    'blocks %s users',
    async (status) => {
      await db.user.update({ where: { id: amir.user.id }, data: { status } });
      await create().expect(403);
      await api()
        .post('/auth/login')
        .send({ email: 'amir@example.com', password })
        .expect(401);
    },
  );
  it('updates and reads own profile', async () => {
    await api()
      .patch('/users/me')
      .set('Authorization', auth(amir.accessToken))
      .send({
        displayName: 'Amir',
        bio: 'Hello',
        countryCode: 'KE',
        avatarUrl: 'https://example.com/avatar.png',
      })
      .expect(200);
    const res = await api()
      .get('/users/me')
      .set('Authorization', auth(amir.accessToken))
      .expect(200);
    expect(res.body.profile.countryCode).toBe('KE');
    expect(res.body.displayName).toBe('Amir');
  });
  it('lists, deduplicates and deletes only owned game accounts', async () => {
    const res = await api()
      .get('/users/me/game-accounts')
      .set('Authorization', auth(amir.accessToken))
      .expect(200);
    expect(res.body).toHaveLength(1);
    await api()
      .post('/users/me/game-accounts')
      .set('Authorization', auth(amir.accessToken))
      .send({ gameId, platform: 'PS5', gamertag: 'newtag' })
      .expect(409);
    const id = res.body[0].id as string;
    await api()
      .delete(`/users/me/game-accounts/${id}`)
      .set('Authorization', auth(samuel.accessToken))
      .expect(404);
    await api()
      .delete(`/users/me/game-accounts/${id}`)
      .set('Authorization', auth(amir.accessToken))
      .expect(200);
    await create().expect(400);
  });
  it('creates OPEN challenge with authenticated creator and no automatic funding', async () => {
    const res = await create().expect(201);
    expect(res.body.creatorId).toBe(amir.user.id);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.players).toHaveLength(1);
    expect(
      (await ledger.getChallengeVault(res.body.id as string)).balance,
    ).toBe(0);
  });
  it('rejects unauthenticated creation', async () => {
    await api().post('/challenges').send({}).expect(401);
  });
  it.each([0, -1, 1.5, 2147483648])(
    'rejects invalid stake %s',
    async (stakeAmount) => {
      await create({ stakeAmount }).expect(400);
    },
  );
  it('rejects unknown and disabled games', async () => {
    await create({ gameId: 'c000000000000000000000000' }).expect(400);
    await db.game.update({ where: { id: gameId }, data: { enabled: false } });
    await create().expect(400);
  });
  it('requires matching platform accounts when joining', async () => {
    await db.gameAccount.deleteMany({ where: { userId: samuel.user.id } });
    await join(challengeId).expect(400);
  });
  it('rejects self join, duplicate join and third player', async () => {
    expect((await join(challengeId, amir).expect(409)).body.code).toBe(
      'CHALLENGE_SELF_JOIN',
    );
    expect((await join(challengeId).expect(200)).body.status).toBe('JOINED');
    expect((await join(challengeId).expect(409)).body.code).toBe(
      'CHALLENGE_ALREADY_JOINED',
    );
    expect((await join(challengeId, third).expect(409)).body.code).toBe(
      'CHALLENGE_FULL',
    );
  });
  it('allows exactly one racer to take the final slot', async () => {
    const results = await Promise.all([
      join(challengeId),
      join(challengeId, third),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.challengePlayer.count({ where: { challengeId } })).toBe(2);
  });
  it.each(['OPEN', 'JOINED'])(
    'creator can cancel unfunded %s challenge',
    async (state) => {
      if (state === 'JOINED') await join(challengeId).expect(200);
      await action(challengeId, 'cancel', samuel).expect(403);
      expect(
        (await action(challengeId, 'cancel').expect(200)).body.status,
      ).toBe('CANCELLED');
      await join(challengeId, third).expect(409);
    },
  );
  it('filters discovery and uses stable cursor pagination', async () => {
    await create({ stakeAmount: 20 }).expect(201);
    await create({ stakeAmount: 30 }).expect(201);
    const first = await api()
      .get(
        `/challenges?gameId=${gameId}&platform=PS5&status=OPEN&minimumStake=10&maximumStake=20&limit=1`,
      )
      .set('Authorization', auth(samuel.accessToken))
      .expect(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await api()
      .get(
        `/challenges?gameId=${gameId}&maximumStake=20&limit=1&cursor=${first.body.nextCursor}`,
      )
      .set('Authorization', auth(samuel.accessToken))
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    expect(second.body.nextCursor).toBeNull();
    expect(JSON.stringify(first.body)).not.toMatch(
      /passwordHash|refreshTokenHash|email|auditLogs/,
    );
  });
  it('expires only OPEN challenges through the internal domain action', async () => {
    const service = app.get(ChallengesService);
    expect((await service.expire(challengeId)).status).toBe('EXPIRED');
    await join(challengeId).expect(409);
    const joinedId = (await create().expect(201)).body.id as string;
    await join(joinedId).expect(200);
    await expect(service.expire(joinedId)).rejects.toThrow(
      'Only open challenges can expire.',
    );
  });
  it('completes Amir/Samuel funding with exact balances and zero conservation', async () => {
    const amirLogin = await api()
      .post('/auth/login')
      .send({ email: 'amir@example.com', password })
      .expect(200);
    const samuelLogin = await api()
      .post('/auth/login')
      .send({ email: 'samuel@example.com', password })
      .expect(200);
    amir.accessToken = amirLogin.body.accessToken as string;
    samuel.accessToken = samuelLogin.body.accessToken as string;
    for (const user of [amir, samuel]) {
      await api()
        .patch('/users/me')
        .set('Authorization', auth(user.accessToken))
        .send({ displayName: user.user.username, countryCode: 'KE' })
        .expect(200);
    }
    challengeId = (await create().expect(201)).body.id as string;
    const discovered = await api()
      .get(`/challenges?gameId=${gameId}&status=OPEN`)
      .set('Authorization', auth(samuel.accessToken))
      .expect(200);
    expect(
      (discovered.body.items as Array<{ id: string }>).map((item) => item.id),
    ).toContain(challengeId);
    await join(challengeId).expect(200);
    const first = await action(challengeId, 'fund').expect(200);
    expect(first.body.challenge.status).toBe('JOINED');
    expect(first.body.vaultBalance).toBe(10);
    expect((await ledger.getUserBalance(amir.user.id)).balance).toBe(90);
    const second = await action(challengeId, 'fund', samuel).expect(200);
    expect(second.body.challenge.status).toBe('FUNDED');
    expect(second.body.vaultBalance).toBe(20);
    expect((await ledger.getUserBalance(samuel.user.id)).balance).toBe(90);
    const entries = await db.ledgerEntry.findMany();
    expect(
      entries.reduce(
        (sum, e) => sum + (e.direction === 'CREDIT' ? e.amount : -e.amount),
        0,
      ),
    ).toBe(0);
  });
  it('requires two players, participation and an idempotency key to fund', async () => {
    await action(challengeId, 'fund').expect(409);
    await join(challengeId).expect(200);
    await action(challengeId, 'fund', third).expect(403);
    await api()
      .post(`/challenges/${challengeId}/fund`)
      .set('Authorization', auth(amir.accessToken))
      .send({})
      .expect(400);
  });
  it('retries the same key without double debit and rejects a different duplicate key', async () => {
    await join(challengeId).expect(200);
    await action(challengeId, 'fund').expect(200);
    await action(challengeId, 'fund').expect(200);
    const res = await action(
      challengeId,
      'fund',
      amir,
      {},
      'different-key-001',
    ).expect(409);
    expect(res.body.code).toBe('CHALLENGE_ALREADY_FUNDED');
    expect((await ledger.getUserBalance(amir.user.id)).balance).toBe(90);
  });
  it('concurrent duplicate funding debits once', async () => {
    await join(challengeId).expect(200);
    const results = await Promise.all([
      action(challengeId, 'fund'),
      action(challengeId, 'fund'),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await ledger.getChallengeVault(challengeId)).balance).toBe(10);
  });
  it('concurrent participant funding reaches FUNDED exactly once', async () => {
    await join(challengeId).expect(200);
    const results = await Promise.all([
      action(challengeId, 'fund'),
      action(challengeId, 'fund', samuel),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await ledger.getChallengeVault(challengeId)).balance).toBe(20);
    expect(
      (await db.challenge.findUniqueOrThrow({ where: { id: challengeId } }))
        .status,
    ).toBe('FUNDED');
  });
  it('rejects cancellation with locked funds', async () => {
    await join(challengeId).expect(200);
    await action(challengeId, 'fund').expect(200);
    expect((await action(challengeId, 'cancel').expect(409)).body.code).toBe(
      'CHALLENGE_HAS_LOCKED_FUNDS',
    );
  });
  it('cancel/fund race never leaves a cancelled funded vault', async () => {
    await join(challengeId).expect(200);
    const results = await Promise.all([
      action(challengeId, 'cancel'),
      action(challengeId, 'fund'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const challenge = await db.challenge.findUniqueOrThrow({
      where: { id: challengeId },
    });
    expect((await ledger.getChallengeVault(challengeId)).balance).toBe(
      challenge.status === 'CANCELLED' ? 0 : 10,
    );
  });
  it('rejects insufficient funds with no partial ledger mutation', async () => {
    const id = (await create({ stakeAmount: 101 }).expect(201)).body
      .id as string;
    await join(id).expect(200);
    expect((await action(id, 'fund').expect(400)).body.code).toBe(
      'LEDGER_INSUFFICIENT_FUNDS',
    );
    expect((await ledger.getChallengeVault(id)).balance).toBe(0);
    expect((await ledger.getUserBalance(amir.user.id)).balance).toBe(100);
  });
  it.each(['role', 'status'])(
    'rejects registration privilege field %s',
    async (field) => {
      await api()
        .post('/auth/register')
        .send({
          email: 'evil@example.com',
          username: 'evil',
          password,
          [field]: field === 'role' ? 'ADMIN' : 'ACTIVE',
        })
        .expect(400);
    },
  );
  it.each(['balance', 'role', 'status', 'trustScore', 'accounts'])(
    'rejects profile protected field %s',
    async (field) => {
      await api()
        .patch('/users/me')
        .set('Authorization', auth(amir.accessToken))
        .send({ [field]: 100 })
        .expect(400);
    },
  );
  it.each(['creatorId', 'status', 'userId'])(
    'rejects challenge protected field %s',
    async (field) => {
      await create({ [field]: third.user.id }).expect(400);
    },
  );
  it.each(['join', 'fund', 'cancel'])(
    'rejects identity spoofing in %s body',
    async (verb) => {
      await action(challengeId, verb, samuel, { userId: amir.user.id }).expect(
        400,
      );
    },
  );
  it('has no arbitrary status PATCH or public settlement route', async () => {
    await api()
      .patch(`/challenges/${challengeId}`)
      .set('Authorization', auth(amir.accessToken))
      .send({ status: 'FUNDED' })
      .expect(404);
    await action(challengeId, 'settle').expect(404);
  });
  it('prevents reading another user ledger or private vault', async () => {
    await api()
      .get(`/users/${samuel.user.id}/balance`)
      .set('Authorization', auth(amir.accessToken))
      .expect(403);
    await api()
      .get(`/users/${samuel.user.id}/ledger`)
      .set('Authorization', auth(amir.accessToken))
      .expect(403);
    await api()
      .get(`/challenges/${challengeId}/vault`)
      .set('Authorization', auth(third.accessToken))
      .expect(403);
  });
  it('writes audit events without secrets', async () => {
    await join(challengeId).expect(200);
    await action(challengeId, 'fund').expect(200);
    const logs = await db.auditLog.findMany();
    expect(logs.map((l) => l.action)).toEqual(
      expect.arrayContaining([
        'USER_REGISTERED',
        'CHALLENGE_CREATED',
        'CHALLENGE_JOINED',
        'CHALLENGE_FUNDED',
      ]),
    );
    expect(JSON.stringify(logs)).not.toMatch(
      /password|accessToken|refreshToken|correct horse/,
    );
  });
  it('rate limits repeated authentication attempts through shared Redis', async () => {
    const responses = await Promise.all(
      Array.from({ length: 21 }, () =>
        api().post('/auth/login').send({ email: 'bad' }),
      ),
    );
    expect(responses.filter((r) => r.status === 429)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 400)).toHaveLength(20);
    await api().post('/AUTH/LOGIN/').send({ email: 'bad' }).expect(429);
  });
});
