import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'fs/promises';
import { resolve, join } from 'path';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/database/prisma.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { JwtService } from '@nestjs/jwt';
import { hashPassword } from '../src/auth/password';

jest.setTimeout(60000);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',
  'base64',
);
interface Player {
  id: string;
  token: string;
}
describe('Phase 4 real PostgreSQL match lifecycle and evidence', () => {
  let app: INestApplication, db: PrismaService, ledger: LedgerService;
  let a: Player, b: Player, outsider: Player, moderator: Player;
  let gameId: string, challengeId: string, matchId: string;
  let passwordHash: string;
  const root = resolve('storage', `phase4-tests-${randomUUID()}`);
  const password = 'correct horse battery staple';
  const previousStorage = process.env.EVIDENCE_STORAGE_DIR;
  const previousImageLimit = process.env.EVIDENCE_SCREENSHOT_MAX_BYTES;
  const previousVideoLimit = process.env.EVIDENCE_VIDEO_MAX_BYTES;
  const api = () => request(app.getHttpServer());
  const bearer = (p: Player) => `Bearer ${p.token}`;
  const action = (verb: string, p = a, body: Record<string, unknown> = {}) =>
    api()
      .post(`/matches/${matchId}/${verb}`)
      .set('Authorization', bearer(p))
      .send(body);
  const submit = (
    p = a,
    body: Record<string, unknown> = { myScore: 4, opponentScore: 2 },
  ) => action('result', p, body);
  const upload = (
    p = a,
    data = png,
    name = 'score.png',
    mime = 'image/png',
    type = 'SCREENSHOT',
  ) =>
    api()
      .post(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(p))
      .field('type', type)
      .attach('file', data, { filename: name, contentType: mime });
  const start = async () => {
    await action('ready').expect(200);
    await action('ready', b).expect(200);
  };
  const fund = (p: Player, id: string, key = 'fund-phase4-test') =>
    api()
      .post(`/challenges/${id}/fund`)
      .set('Authorization', bearer(p))
      .set('Idempotency-Key', key)
      .send({});
  const createChallenge = async () => {
    const res = await api()
      .post('/challenges')
      .set('Authorization', bearer(a))
      .send({
        gameId,
        stakeAmount: 10,
        currency: 'TEST',
        platform: 'PS5',
        mode: '1v1',
      })
      .expect(201);
    const id = res.body.id as string;
    await api()
      .post(`/challenges/${id}/join`)
      .set('Authorization', bearer(b))
      .send({})
      .expect(200);
    return id;
  };
  beforeAll(async () => {
    process.env.EVIDENCE_STORAGE_DIR = root;
    process.env.EVIDENCE_SCREENSHOT_MAX_BYTES = '1024';
    process.env.EVIDENCE_VIDEO_MAX_BYTES = '2048';
    await mkdir(root, { recursive: true });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    ledger = app.get(LedgerService);
    passwordHash = await hashPassword(password);
  });
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE users, games, ledger_transactions RESTART IDENTITY CASCADE',
    );
    const players: Player[] = [];
    for (const username of ['amir', 'samuel', 'outsider', 'moderator']) {
      const user = await db.user.create({
        data: {
          email: `${username}@example.com`,
          username,
          passwordHash,
          role: username === 'moderator' ? 'MODERATOR' : 'USER',
        },
      });
      // Phase 3 tests exercise login; Phase 4 seeds real sessions and still traverses both auth guards.
      const session = await db.session.create({ data: {
        userId: user.id,
        refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      } });
      const token = await app.get(JwtService).signAsync({ sub: user.id, role: user.role, sessionId: session.id });
      players.push({ id: user.id, token });
      await ledger.createInitialCredit({
        userId: user.id,
        amount: 100,
        idempotencyKey: `init:${user.id}`,
      });
    }
    [a, b, outsider, moderator] = players;
    gameId = (await db.game.create({ data: { name: 'FC 26', slug: 'fc-26' } }))
      .id;
    for (const p of [a, b])
      await db.gameAccount.create({
        data: { userId: p.id, gameId, platform: 'PS5', gamertag: p.id },
      });
    challengeId = await createChallenge();
    await fund(a, challengeId).expect(200);
    const second = await fund(b, challengeId).expect(200);
    matchId = second.body.challenge.matches[0].id as string;
  });
  afterAll(async () => {
    if (app) await app.close();
    // Remove only this suite's flat object files inside its explicit storage root.
    for (const name of await readdir(root)) await unlink(join(root, name));
    if (previousStorage === undefined) delete process.env.EVIDENCE_STORAGE_DIR;
    else process.env.EVIDENCE_STORAGE_DIR = previousStorage;
    if (previousImageLimit === undefined)
      delete process.env.EVIDENCE_SCREENSHOT_MAX_BYTES;
    else process.env.EVIDENCE_SCREENSHOT_MAX_BYTES = previousImageLimit;
    if (previousVideoLimit === undefined)
      delete process.env.EVIDENCE_VIDEO_MAX_BYTES;
    else process.env.EVIDENCE_VIDEO_MAX_BYTES = previousVideoLimit;
  });
  it('creates one READY match with two participants on full funding and replay', async () => {
    await fund(b, challengeId).expect(200);
    expect(await db.match.count({ where: { challengeId } })).toBe(1);
    const match = await db.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { participants: true, events: true },
    });
    expect(match.status).toBe('READY');
    expect(match.participants).toHaveLength(2);
    expect(match.participants.every((p) => p.readyAt === null)).toBe(true);
    expect(match.events.map((e) => e.type)).toEqual(['MATCH_CREATED']);
    await expect(
      db.match.create({ data: { challengeId } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('concurrent funding creates exactly one match and one creation event', async () => {
    const id = await createChallenge();
    const responses = await Promise.all([
      fund(a, id),
      fund(b, id),
      fund(b, id),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    const matches = await db.match.findMany({
      where: { challengeId: id },
      include: { events: true },
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].events).toHaveLength(1);
  });
  it('one ready stays READY; both ready start and retries preserve timestamps', async () => {
    const first = await action('ready').expect(200);
    expect(first.body.status).toBe('READY');
    expect(first.body.startedAt).toBeNull();
    const retry = await action('ready').expect(200);
    expect(retry.body.readyAt).toBe(first.body.readyAt);
    const second = await action('ready', b).expect(200);
    expect(second.body.status).toBe('IN_PROGRESS');
    expect(second.body.startedAt).toBeTruthy();
    expect((await action('ready', b).expect(200)).body.startedAt).toBe(
      second.body.startedAt,
    );
    expect(
      await db.matchEvent.count({ where: { matchId, type: 'PLAYER_READY' } }),
    ).toBe(2);
  });
  it('simultaneous readiness starts once', async () => {
    const responses = await Promise.all([
      action('ready'),
      action('ready', b),
      action('ready'),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: matchId } })).status,
    ).toBe('IN_PROGRESS');
    expect(
      await db.matchEvent.count({ where: { matchId, type: 'MATCH_STARTED' } }),
    ).toBe(1);
  });
  it('private room exposes only safe information to participants and staff', async () => {
    const room = await api()
      .get(`/matches/${matchId}`)
      .set('Authorization', bearer(a))
      .expect(200);
    expect(room.body.challenge.game.name).toBe('FC 26');
    expect(room.body.challenge.platform).toBe('PS5');
    expect(room.body.challenge.stakeAmount).toBe(10);
    expect(room.body.vault).toEqual({ balance: 20, status: 'LOCKED' });
    expect(JSON.stringify(room.body)).not.toMatch(
      /password|refreshToken|sessions|auditLogs|email/,
    );
    await api()
      .get(`/matches/${matchId}`)
      .set('Authorization', bearer(moderator))
      .expect(200);
    await db.user.update({
      where: { id: moderator.id },
      data: { role: 'ADMIN' },
    });
    await api()
      .get(`/matches/${matchId}`)
      .set('Authorization', bearer(moderator))
      .expect(200);
    await api()
      .get(`/matches/${matchId}`)
      .set('Authorization', bearer(outsider))
      .expect(403);
    await api().get(`/matches/${matchId}`).expect(401);
  });
  it.each(['ready', 'result', 'result/confirm', 'result/dispute'])(
    'rejects nonparticipant action %s, including staff',
    async (verb) => {
      const body =
        verb === 'result'
          ? { myScore: 4, opponentScore: 2 }
          : verb.endsWith('dispute')
            ? { reason: 'Score is incorrect' }
            : {};
      await action(verb, outsider, body).expect(403);
      await action(verb, moderator, body).expect(403);
    },
  );
  it('rejects results before start', async () => {
    await submit().expect(409);
  });
  it.each([
    [4, 2, true],
    [1, 3, false],
  ])(
    'derives the winner from scores %s:%s',
    async (myScore, opponentScore, selfWins) => {
      await start();
      const res = await submit(a, { myScore, opponentScore }).expect(201);
      expect(res.body.winnerUserId).toBe(selfWins ? a.id : b.id);
      expect(res.body.submittedByUserId).toBe(a.id);
      expect(res.body.submittedAt).toBeTruthy();
      expect(
        (await db.match.findUniqueOrThrow({ where: { id: matchId } })).status,
      ).toBe('RESULT_SUBMITTED');
    },
  );
  it.each([
    [-1, 2],
    [1.5, 2],
    [2, -1],
    [2, 1.5],
    [2, 2],
    [100001, 2],
  ])('rejects scores %s:%s', async (myScore, opponentScore) => {
    await start();
    await submit(a, { myScore, opponentScore }).expect(400);
    expect(await db.matchResult.count({ where: { matchId } })).toBe(0);
  });
  it.each(['winnerUserId', 'submittedByUserId', 'userId', 'status'])(
    'rejects supplied %s',
    async (field) => {
      await start();
      await submit(a, { myScore: 4, opponentScore: 2, [field]: b.id }).expect(
        400,
      );
    },
  );
  it('rejects duplicate/opponent replacement results and status PATCH', async () => {
    await start();
    await submit().expect(201);
    await submit().expect(409);
    await submit(b).expect(409);
    await api()
      .patch(`/matches/${matchId}`)
      .set('Authorization', bearer(a))
      .send({ status: 'CONFIRMED' })
      .expect(404);
    await api()
      .patch(`/matches/${matchId}/result`)
      .set('Authorization', bearer(b))
      .send({ myScore: 99 })
      .expect(404);
  });
  it('concurrent result submissions create one proposal', async () => {
    await start();
    const results = await Promise.all([submit(), submit(b)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.matchResult.count({ where: { matchId } })).toBe(1);
  });
  it('submitter cannot confirm or dispute own proposal', async () => {
    await start();
    await submit().expect(201);
    await action('result/confirm').expect(403);
    await action('result/dispute', a, { reason: 'Wrong score' }).expect(403);
  });
  async function assertLocked(status: 'CONFIRMED' | 'DISPUTED') {
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
    expect((await ledger.getChallengeVault(challengeId)).balance).toBe(20);
    expect((await ledger.getUserBalance(a.id)).balance).toBe(90);
    expect((await ledger.getUserBalance(b.id)).balance).toBe(90);
    expect(
      await db.ledgerTransaction.count({ where: { type: 'MATCH_SETTLEMENT' } }),
    ).toBe(0);
    const entries = await db.ledgerEntry.findMany();
    expect(
      entries.reduce(
        (s, e) => s + (e.direction === 'CREDIT' ? e.amount : -e.amount),
        0,
      ),
    ).toBe(0);
  }
  it('opponent confirms all domain states without settlement', async () => {
    await start();
    await submit().expect(201);
    await action('result/confirm', b).expect(200);
    await assertLocked('CONFIRMED');
    const result = await db.matchResult.findUniqueOrThrow({
      where: { matchId },
    });
    expect(result.confirmedByUserId).toBe(b.id);
    expect(result.confirmedAt).not.toBeNull();
    await action('result/confirm', b).expect(409);
    await submit().expect(409);
  });
  it('opponent disputes into review without payout and cannot duplicate dispute', async () => {
    await start();
    await submit().expect(201);
    await action('result/dispute', b, { reason: 'Score is incorrect' }).expect(
      200,
    );
    await assertLocked('DISPUTED');
    const disputes = await db.dispute.findMany();
    expect(disputes).toHaveLength(1);
    expect(disputes[0].status).toBe('REVIEW');
    await action('result/dispute', b, { reason: 'Score is incorrect' }).expect(
      409,
    );
  });
  it('confirmation/dispute race has exactly one terminal outcome', async () => {
    await start();
    await submit().expect(201);
    const res = await Promise.all([
      action('result/confirm', b),
      action('result/dispute', b, { reason: 'Incorrect score' }),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    const status = res[0].status === 200 ? 'CONFIRMED' : 'DISPUTED';
    await assertLocked(status);
    expect(await db.dispute.count()).toBe(status === 'DISPUTED' ? 1 : 0);
  });
  it.each(['confirm', 'dispute'])(
    'concurrent duplicate %s writes one outcome',
    async (verb) => {
      await start();
      await submit().expect(201);
      const body = verb === 'dispute' ? { reason: 'Score is incorrect' } : {};
      const res = await Promise.all([
        action(`result/${verb}`, b, body),
        action(`result/${verb}`, b, body),
      ]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    },
  );
  it('stores immutable evidence metadata, SHA-256 and private bytes', async () => {
    await start();
    const res = await upload().expect(201);
    expect(res.body.sha256).toBe(
      createHash('sha256').update(new Uint8Array(png)).digest('hex'),
    );
    expect(res.body.size).toBe(png.length);
    expect(res.body.uploadedByUserId).toBe(a.id);
    const stored = await db.evidence.findUniqueOrThrow({
      where: { id: res.body.id as string },
    });
    expect(stored.objectKey).toMatch(/^[a-f0-9-]{36}$/);
    expect(stored.objectKey).not.toContain('score.png');
    expect(await readFile(join(root, stored.objectKey!))).toEqual(png);
    const content = await api()
      .get(`/matches/${matchId}/evidence/${stored.id}/content`)
      .set('Authorization', bearer(b))
      .expect(200);
    expect(content.body).toEqual(png);
    expect(content.headers['x-content-type-options']).toBe('nosniff');
    expect(content.headers['cache-control']).toContain('no-store');
    const list = await api()
      .get(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(b))
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toMatch(/objectKey|password|storage/);
  });
  it('forbids outsiders from uploading, listing, reading and guessing evidence across matches', async () => {
    await start();
    const res = await upload().expect(201);
    await upload(outsider).expect(403);
    await api()
      .get(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(outsider))
      .expect(403);
    await api()
      .get(`/matches/${matchId}/evidence/${res.body.id}/content`)
      .set('Authorization', bearer(outsider))
      .expect(403);
    const other = await createChallenge();
    await fund(a, other).expect(200);
    await fund(b, other).expect(200);
    const otherMatch = await db.match.findUniqueOrThrow({
      where: { challengeId: other },
    });
    await api()
      .get(`/matches/${otherMatch.id}/evidence/${res.body.id}/content`)
      .set('Authorization', bearer(a))
      .expect(404);
  });
  it.each([
    ['image/jpeg', 'score.png'],
    ['text/html', 'score.png'],
    ['image/png', 'score.exe'],
  ])('rejects MIME/extension mismatch %s %s', async (mime, name) => {
    await start();
    await upload(a, png, name, mime).expect(400);
    expect(await db.evidence.count()).toBe(0);
  });
  it('rejects forged image contents and missing files', async () => {
    await start();
    await upload(a, Buffer.from('<script>evil</script>')).expect(400);
    await api()
      .post(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(a))
      .field('type', 'SCREENSHOT')
      .expect(400);
  });
  it('enforces per-type and transport size limits', async () => {
    await start();
    await upload(a, Buffer.alloc(1025)).expect(413);
    await upload(a, Buffer.alloc(2049)).expect(413);
    expect(await db.evidence.count()).toBe(0);
  });
  it('cannot spoof evidence ownership', async () => {
    await start();
    await api()
      .post(`/matches/${matchId}/evidence`)
      .set('Authorization', bearer(a))
      .field('type', 'SCREENSHOT')
      .field('uploadedByUserId', b.id)
      .attach('file', png, 'score.png')
      .expect(400);
  });
  it('locks submitter evidence at submission and all evidence after dispute', async () => {
    await start();
    const original = await upload().expect(201);
    await submit().expect(201);
    await upload().expect(409);
    await upload(b).expect(201);
    await action('result/dispute', b, { reason: 'Incorrect score' }).expect(
      200,
    );
    await upload(b).expect(409);
    await api()
      .delete(`/matches/${matchId}/evidence/${original.body.id}`)
      .set('Authorization', bearer(a))
      .expect(404);
    await api()
      .patch(`/matches/${matchId}/evidence/${original.body.id}`)
      .set('Authorization', bearer(a))
      .send({ sha256: 'changed' })
      .expect(404);
    await expect(
      db.evidence.update({
        where: { id: original.body.id as string },
        data: { originalFilename: 'changed.png' },
      }),
    ).rejects.toThrow();
    await expect(
      db.evidence.delete({ where: { id: original.body.id as string } }),
    ).rejects.toThrow();
    expect(
      (
        await db.evidence.findUniqueOrThrow({
          where: { id: original.body.id as string },
        })
      ).sha256,
    ).toBe(original.body.sha256);
  });
  it('closes uploads after confirmation', async () => {
    await start();
    await submit().expect(201);
    await action('result/confirm', b).expect(200);
    await upload(b).expect(409);
  });
  it('serializes evidence/dispute race so no evidence appears after dispute event', async () => {
    await start();
    await submit().expect(201);
    const res = await Promise.all([
      upload(b),
      action('result/dispute', b, { reason: 'Incorrect score' }),
    ]);
    expect([201, 409]).toContain(res[0].status);
    expect(res[1].status).toBe(200);
    const events = await db.matchEvent.findMany({
      where: { matchId },
      orderBy: { sequence: 'asc' },
    });
    expect(events[events.length - 1].type).toBe('RESULT_DISPUTED');
  });
  it('rejects externally tampered evidence rather than serving different bytes', async () => {
    await start();
    const res = await upload().expect(201);
    const row = await db.evidence.findUniqueOrThrow({
      where: { id: res.body.id as string },
    });
    await writeFile(join(root, row.objectKey!), 'tampered');
    const response = await api()
      .get(`/matches/${matchId}/evidence/${row.id}/content`)
      .set('Authorization', bearer(a))
      .expect(500);
    expect(response.body.code).toBe('EVIDENCE_INTEGRITY_ERROR');
  });
  it('timeline is ordered, safe and contains the lifecycle events', async () => {
    await start();
    await upload().expect(201);
    await submit().expect(201);
    await action('result/confirm', b).expect(200);
    const res = await api()
      .get(`/matches/${matchId}/timeline`)
      .set('Authorization', bearer(a))
      .expect(200);
    const events = res.body as Array<{ type: string; sequence: number }>;
    expect(events.map((e) => e.type)).toEqual([
      'MATCH_CREATED',
      'PLAYER_READY',
      'PLAYER_READY',
      'MATCH_STARTED',
      'EVIDENCE_UPLOADED',
      'RESULT_SUBMITTED',
      'RESULT_CONFIRMED',
    ]);
    expect(
      events.every((e, i) => !i || e.sequence > events[i - 1].sequence),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(
      /password|refresh|reason|objectKey/,
    );
    await api()
      .get(`/matches/${matchId}/timeline`)
      .set('Authorization', bearer(outsider))
      .expect(403);
  });
});
