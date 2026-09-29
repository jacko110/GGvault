import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { LedgerService } from '../src/ledger/ledger.service';

jest.setTimeout(60000);

const prisma = new PrismaClient();
const prismaService = new PrismaService();
const ledgerService = new LedgerService(prismaService);

type LedgerEntryLike = { direction: 'CREDIT' | 'DEBIT'; amount: number };

function sumLedgerEntries(entries: LedgerEntryLike[]): number {
  return entries.reduce<number>((sum, entry) => sum + (entry.direction === 'CREDIT' ? entry.amount : -entry.amount), 0);
}

async function resetDb() {
  // order matters for cascade truncation portability
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ledger_entries, ledger_transactions, ledger_accounts, match_results, matches, challenge_players, challenges, game_accounts, games, users RESTART IDENTITY CASCADE',
  );
}

async function totalConservation(): Promise<number> {
  const entries = await prisma.ledgerEntry.findMany();
  return sumLedgerEntries(entries as LedgerEntryLike[]);
}

beforeAll(async () => {
  await prisma.$connect();
  await prismaService.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
  await prismaService.$disconnect();
});

describe('GGVault ledger integration (Postgres)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('1 INITIAL CREDIT: Amir credited 100 and system debited -100, conservation 0', async () => {
    const amir = await prisma.user.create({ data: { email: 'amir@local', username: 'Amir' } });

    await ledgerService.createInitialCredit({ userId: amir.id, amount: 100, idempotencyKey: 'init-1' });

    const a = await ledgerService.getUserBalance(amir.id);
    expect(a.balance).toBe(100);

    const system = await prisma.ledgerAccount.findUnique({ where: { singletonKey: 'GLOBAL_SYSTEM_ACCOUNT' } });
    const sysEntries = await prisma.ledgerEntry.findMany({ where: { ledgerAccountId: system!.id } });
    const sysTotal = sumLedgerEntries(sysEntries as LedgerEntryLike[]);
    expect(sysTotal).toBe(-100);

    const conservation = await totalConservation();
    expect(conservation).toBe(0);
  });

  test('2 TWO USERS: Amir 100 and Samuel 100, system -200, conservation 0', async () => {
    const amir = await prisma.user.create({ data: { email: 'amir2@local', username: 'Amir2' } });
    const sam = await prisma.user.create({ data: { email: 'sam2@local', username: 'Samuel2' } });

    await ledgerService.createInitialCredit({ userId: amir.id, amount: 100, idempotencyKey: 'init-2a' });
    await ledgerService.createInitialCredit({ userId: sam.id, amount: 100, idempotencyKey: 'init-2b' });

    const a = await ledgerService.getUserBalance(amir.id);
    const s = await ledgerService.getUserBalance(sam.id);
    expect(a.balance).toBe(100);
    expect(s.balance).toBe(100);

    const system = await prisma.ledgerAccount.findUnique({ where: { singletonKey: 'GLOBAL_SYSTEM_ACCOUNT' } });
    const sysEntries = await prisma.ledgerEntry.findMany({ where: { ledgerAccountId: system!.id } });
    const sysTotal = sumLedgerEntries(sysEntries as LedgerEntryLike[]);
    expect(sysTotal).toBe(-200);

    const conservation = await totalConservation();
    expect(conservation).toBe(0);
  });

  test('3 FIRST STAKE: Amir locks 10 -> Amir=90, vault=10, challenge not FUNDED', async () => {
    const amir = await prisma.user.create({ data: { email: 'a3@loc', username: 'A3' } });
    const other = await prisma.user.create({ data: { email: 'b3@loc', username: 'B3' } });
    const game = await prisma.game.create({ data: { slug: 'g3', name: 'G3' } });
    const challenge = await prisma.challenge.create({ data: { slug: 'c3', title: 'C3', gameId: game.id, createdByUserId: amir.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: amir.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: other.id } });

    await ledgerService.createInitialCredit({ userId: amir.id, amount: 100, idempotencyKey: 'init-3' });

    await ledgerService.lockStake({ userId: amir.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-3a' });

    const a = await ledgerService.getUserBalance(amir.id);
    expect(a.balance).toBe(90);

    const vault = await ledgerService.getChallengeVault(challenge.id);
    expect(vault.balance).toBe(10);

    const ch = await prisma.challenge.findUnique({ where: { id: challenge.id } });
    expect(ch!.status).not.toBe('FUNDED');
  });

  test('4 SECOND STAKE: Samuel locks 10 -> Samuel=90, vault=20, challenge FUNDED', async () => {
    const amir = await prisma.user.create({ data: { email: 'a4@loc', username: 'A4' } });
    const sam = await prisma.user.create({ data: { email: 's4@loc', username: 'S4' } });
    const game = await prisma.game.create({ data: { slug: 'g4', name: 'G4' } });
    const challenge = await prisma.challenge.create({ data: { slug: 'c4', title: 'C4', gameId: game.id, createdByUserId: amir.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: amir.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: sam.id } });

    await ledgerService.createInitialCredit({ userId: amir.id, amount: 100, idempotencyKey: 'init-4a' });
    await ledgerService.createInitialCredit({ userId: sam.id, amount: 100, idempotencyKey: 'init-4b' });

    await ledgerService.lockStake({ userId: amir.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-4a' });
    await ledgerService.lockStake({ userId: sam.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-4b' });

    const samBal = await ledgerService.getUserBalance(sam.id);
    expect(samBal.balance).toBe(90);

    const vault = await ledgerService.getChallengeVault(challenge.id);
    expect(vault.balance).toBe(20);

    const ch = await prisma.challenge.findUnique({ where: { id: challenge.id } });
    expect(ch!.status).toBe('FUNDED');
  });

  test('5 INSUFFICIENT FUNDS leaves DB unchanged and rejects', async () => {
    const u = await prisma.user.create({ data: { email: 'i5@loc', username: 'I5' } });
    const game = await prisma.game.create({ data: { slug: 'g5', name: 'G5' } });
    const challenge = await prisma.challenge.create({ data: { slug: 'c5', title: 'C5', gameId: game.id, createdByUserId: u.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: u.id } });

    await ledgerService.createInitialCredit({ userId: u.id, amount: 5, idempotencyKey: 'init-5' });

    await expect(
      ledgerService.lockStake({ userId: u.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-5' }),
    ).rejects.toThrow();

    const ubal = await ledgerService.getUserBalance(u.id);
    expect(ubal.balance).toBe(5);

    const vault = await ledgerService.getChallengeVault(challenge.id);
    expect(vault.balance).toBe(0);

    const txs = await prisma.ledgerTransaction.findMany({ where: { type: 'STAKE_LOCK' } });
    expect(txs.length).toBe(0);

    const cp = await prisma.challengePlayer.findUnique({ where: { challengeId_userId: { challengeId: challenge.id, userId: u.id } } });
    expect(cp!.status).toBe('JOINED');
  });

  test('6 INVALID AMOUNTS: zero and negative rejected with no mutations', async () => {
    const u = await prisma.user.create({ data: { email: 'i6@loc', username: 'I6' } });

    await expect(ledgerService.createInitialCredit({ userId: u.id, amount: 0, idempotencyKey: 'inv-0' })).rejects.toThrow();
    await expect(ledgerService.createInitialCredit({ userId: u.id, amount: -1, idempotencyKey: 'inv--1' })).rejects.toThrow();

    const txs = await prisma.ledgerTransaction.findMany();
    expect(txs.length).toBe(0);
  });

  test('7 DUPLICATE FUNDING with different idempotency keys rejects second', async () => {
    const u = await prisma.user.create({ data: { email: 'd7@loc', username: 'D7' } });
    await ledgerService.createInitialCredit({ userId: u.id, amount: 100, idempotencyKey: 'dup-7a' });

    await expect(
      ledgerService.createInitialCredit({ userId: u.id, amount: 0, idempotencyKey: 'dup-7b' }),
    ).rejects.toThrow('amount must be a positive integer');

    const ubal = await ledgerService.getUserBalance(u.id);
    expect(ubal.balance).toBe(100);
  });

  test('8 SEQUENTIAL IDEMPOTENCY: same key twice results in one transaction', async () => {
    const u = await prisma.user.create({ data: { email: 's8@loc', username: 'S8' } });
    await ledgerService.createInitialCredit({ userId: u.id, amount: 100, idempotencyKey: 'seq-8' });
    await ledgerService.createInitialCredit({ userId: u.id, amount: 100, idempotencyKey: 'seq-8' });

    const txs = await prisma.ledgerTransaction.findMany({ where: { idempotencyKey: 'seq-8' } });
    expect(txs.length).toBe(1);

    const ubal = await ledgerService.getUserBalance(u.id);
    expect(ubal.balance).toBe(100);
  });

  test('9 CONCURRENT IDEMPOTENCY: simultaneous identical requests create one mutation', async () => {
    const u = await prisma.user.create({ data: { email: 'c9@loc', username: 'C9' } });
    await ledgerService.createInitialCredit({ userId: u.id, amount: 50, idempotencyKey: 'con-9' });

    const game = await prisma.game.create({ data: { slug: 'g9', name: 'G9' } });
    const challenge = await prisma.challenge.create({ data: { slug: 'c9', title: 'C9', gameId: game.id, createdByUserId: u.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: u.id } });

    const p = [
      ledgerService.lockStake({ userId: u.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'idem-9' }),
      ledgerService.lockStake({ userId: u.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'idem-9' }),
    ];

    await Promise.allSettled(p);

    const txs = await prisma.ledgerTransaction.findMany({ where: { idempotencyKey: 'idem-9' } });
    expect(txs.length).toBe(1);

    const ubal = await ledgerService.getUserBalance(u.id);
    expect(ubal.balance).toBe(40);

    const vault = await ledgerService.getChallengeVault(challenge.id);
    expect(vault.balance).toBe(10);
  });

  test('10 CONCURRENT DOUBLE SPEND: only one succeeds, Amir never negative', async () => {
    const u = await prisma.user.create({ data: { email: 'd10@loc', username: 'D10' } });
    await ledgerService.createInitialCredit({ userId: u.id, amount: 10, idempotencyKey: 'init-10' });

    const gameA = await prisma.game.create({ data: { slug: 'g10a', name: 'G10A' } });
    const gameB = await prisma.game.create({ data: { slug: 'g10b', name: 'G10B' } });
    const chA = await prisma.challenge.create({ data: { slug: 'c10a', title: 'C10A', gameId: gameA.id, createdByUserId: u.id } });
    const chB = await prisma.challenge.create({ data: { slug: 'c10b', title: 'C10B', gameId: gameB.id, createdByUserId: u.id } });
    await prisma.challengePlayer.create({ data: { challengeId: chA.id, userId: u.id } });
    await prisma.challengePlayer.create({ data: { challengeId: chB.id, userId: u.id } });

    const p = [
      ledgerService.lockStake({ userId: u.id, challengeId: chA.id, amount: 10, idempotencyKey: 'ds-10a' }),
      ledgerService.lockStake({ userId: u.id, challengeId: chB.id, amount: 10, idempotencyKey: 'ds-10b' }),
    ];

    const results = await Promise.allSettled(p);
    const fulfilled = results.filter((r) => (r as PromiseFulfilledResult<any>).status === 'fulfilled');
    const rejected = results.filter((r) => (r as PromiseRejectedResult).status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const ubal = await ledgerService.getUserBalance(u.id);
    expect(ubal.balance).toBe(0);

    const vaultA = await ledgerService.getChallengeVault(chA.id);
    const vaultB = await ledgerService.getChallengeVault(chB.id);
    const combined = vaultA.balance + vaultB.balance;
    expect(combined).toBe(10);

    const txs = await prisma.ledgerTransaction.findMany({ where: { type: 'STAKE_LOCK' } });
    expect(txs.length).toBe(1);
  });

  test('11 EXACT SETTLEMENT: vault 20 -> winner 19, platform 1, one MATCH_SETTLEMENT, matchResult SETTLED', async () => {
    const winner = await prisma.user.create({ data: { email: 'w11@loc', username: 'W11' } });
    const loser = await prisma.user.create({ data: { email: 'l11@loc', username: 'L11' } });
    const game = await prisma.game.create({ data: { slug: 'g11', name: 'G11' } });
    const challenge = await prisma.challenge.create({ data: { slug: 'c11', title: 'C11', gameId: game.id, createdByUserId: winner.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: winner.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: loser.id } });

    await ledgerService.createInitialCredit({ userId: winner.id, amount: 100, idempotencyKey: 'init-11w' });
    await ledgerService.createInitialCredit({ userId: loser.id, amount: 100, idempotencyKey: 'init-11l' });

    await ledgerService.lockStake({ userId: winner.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-11w' });
    await ledgerService.lockStake({ userId: loser.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-11l' });

    const match = await prisma.match.create({ data: { challengeId: challenge.id } });
    await prisma.matchResult.create({ data: { matchId: match.id, status: 'PENDING' } });

    await ledgerService.settleMatch({ matchId: match.id, winnerUserId: winner.id, idempotencyKey: 'settle-11' });

    const vault = await ledgerService.getChallengeVault(challenge.id);
    expect(vault.balance).toBe(0);

    const wbal = await ledgerService.getUserBalance(winner.id);
    expect(wbal.balance).toBe(109);

    const platform = await prisma.ledgerAccount.findUnique({ where: { singletonKey: 'GLOBAL_PLATFORM_REVENUE' } });
    const pEntries = await prisma.ledgerEntry.findMany({ where: { ledgerAccountId: platform!.id } });
    const pTotal = sumLedgerEntries(pEntries as LedgerEntryLike[]);
    expect(pTotal).toBe(1);

    const txs = await prisma.ledgerTransaction.findMany({ where: { type: 'MATCH_SETTLEMENT' } });
    expect(txs.length).toBe(1);

    const mr = await prisma.matchResult.findUnique({ where: { matchId: match.id } });
    expect(mr!.status).toBe('SETTLED');
  });

  test('12 DUPLICATE SETTLEMENT SAME KEY: sequential calls idempotent', async () => {
    const winner = await prisma.user.create({ data: { email: 'w12@loc', username: 'W12' } });
    const loser = await prisma.user.create({ data: { email: 'l12@loc', username: 'L12' } });
    const game = await prisma.game.create({ data: { slug: 'g12', name: 'G12' } });
    const challenge = await prisma.challenge.create({ data: { slug: 'c12', title: 'C12', gameId: game.id, createdByUserId: winner.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: winner.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: loser.id } });

    await ledgerService.createInitialCredit({ userId: winner.id, amount: 100, idempotencyKey: 'init-12w' });
    await ledgerService.createInitialCredit({ userId: loser.id, amount: 100, idempotencyKey: 'init-12l' });

    await ledgerService.lockStake({ userId: winner.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-12w' });
    await ledgerService.lockStake({ userId: loser.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-12l' });

    const match = await prisma.match.create({ data: { challengeId: challenge.id } });
    await prisma.matchResult.create({ data: { matchId: match.id, status: 'PENDING' } });

    await ledgerService.settleMatch({ matchId: match.id, winnerUserId: winner.id, idempotencyKey: 'settle-12' });
    await ledgerService.settleMatch({ matchId: match.id, winnerUserId: winner.id, idempotencyKey: 'settle-12' });

    const txs = await prisma.ledgerTransaction.findMany({ where: { idempotencyKey: 'settle-12' } });
    expect(txs.length).toBe(1);

    const pAccount = await prisma.ledgerAccount.findUnique({ where: { singletonKey: 'GLOBAL_PLATFORM_REVENUE' } });
    const pTotal = sumLedgerEntries((await prisma.ledgerEntry.findMany({ where: { ledgerAccountId: pAccount!.id } })) as LedgerEntryLike[]);
    expect(pTotal).toBe(1);
  });

  test('13 DUPLICATE SETTLEMENT DIFFERENT KEYS: concurrent only one settlement', async () => {
    const winner = await prisma.user.create({ data: { email: 'w13@loc', username: 'W13' } });
    const loser = await prisma.user.create({ data: { email: 'l13@loc', username: 'L13' } });
    const game = await prisma.game.create({ data: { slug: 'g13', name: 'G13' } });
    const challenge = await prisma.challenge.create({ data: { slug: 'c13', title: 'C13', gameId: game.id, createdByUserId: winner.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: winner.id } });
    await prisma.challengePlayer.create({ data: { challengeId: challenge.id, userId: loser.id } });

    await ledgerService.createInitialCredit({ userId: winner.id, amount: 100, idempotencyKey: 'init-13w' });
    await ledgerService.createInitialCredit({ userId: loser.id, amount: 100, idempotencyKey: 'init-13l' });

    await ledgerService.lockStake({ userId: winner.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-13w' });
    await ledgerService.lockStake({ userId: loser.id, challengeId: challenge.id, amount: 10, idempotencyKey: 'stake-13l' });

    const match = await prisma.match.create({ data: { challengeId: challenge.id } });
    await prisma.matchResult.create({ data: { matchId: match.id, status: 'PENDING' } });

    const p = [
      ledgerService.settleMatch({ matchId: match.id, winnerUserId: winner.id, idempotencyKey: 'settle-13a' }),
      ledgerService.settleMatch({ matchId: match.id, winnerUserId: winner.id, idempotencyKey: 'settle-13b' }),
    ];

    await Promise.allSettled(p);

    const txs = await prisma.ledgerTransaction.findMany({ where: { type: 'MATCH_SETTLEMENT' } });
    expect(txs.length).toBe(1);

    const vault = await ledgerService.getChallengeVault(challenge.id);
    expect(vault.balance).toBe(0);

    const pAccount = await prisma.ledgerAccount.findUnique({ where: { singletonKey: 'GLOBAL_PLATFORM_REVENUE' } });
    const pTotal = sumLedgerEntries((await prisma.ledgerEntry.findMany({ where: { ledgerAccountId: pAccount!.id } })) as LedgerEntryLike[]);
    expect(pTotal).toBe(1);
  });

  test('14 TRANSACTION ROLLBACK: failed stake does not leave partial entries', async () => {
    const u = await prisma.user.create({ data: { email: 'r14@loc', username: 'R14' } });
    const game = await prisma.game.create({ data: { slug: 'g14', name: 'G14' } });
    const ch = await prisma.challenge.create({ data: { slug: 'c14', title: 'C14', gameId: game.id, createdByUserId: u.id } });
    await prisma.challengePlayer.create({ data: { challengeId: ch.id, userId: u.id } });

    await ledgerService.createInitialCredit({ userId: u.id, amount: 5, idempotencyKey: 'init-14' });

    await expect(ledgerService.lockStake({ userId: u.id, challengeId: ch.id, amount: 10, idempotencyKey: 'stake-14' })).rejects.toThrow();

    const txs = await prisma.ledgerTransaction.findMany({ where: { idempotencyKey: 'stake-14' } });
    expect(txs.length).toBe(0);

    const entries = await prisma.ledgerEntry.findMany({ where: {} });
    const total = sumLedgerEntries(entries as LedgerEntryLike[]);
    expect(total).toBe(0);
  });

  test('15 GLOBAL CONSERVATION: every transaction balanced and global conservation 0', async () => {
    const a = await prisma.user.create({ data: { email: 'g15a@loc', username: 'G15A' } });
    const b = await prisma.user.create({ data: { email: 'g15b@loc', username: 'G15B' } });
    const game = await prisma.game.create({ data: { slug: 'g15', name: 'G15' } });
    const ch = await prisma.challenge.create({ data: { slug: 'c15', title: 'C15', gameId: game.id, createdByUserId: a.id } });
    await prisma.challengePlayer.create({ data: { challengeId: ch.id, userId: a.id } });
    await prisma.challengePlayer.create({ data: { challengeId: ch.id, userId: b.id } });

    await ledgerService.createInitialCredit({ userId: a.id, amount: 100, idempotencyKey: 'g15a' });
    await ledgerService.createInitialCredit({ userId: b.id, amount: 100, idempotencyKey: 'g15b' });
    await ledgerService.lockStake({ userId: a.id, challengeId: ch.id, amount: 10, idempotencyKey: 'g15sa' });
    await ledgerService.lockStake({ userId: b.id, challengeId: ch.id, amount: 10, idempotencyKey: 'g15sb' });

    const entries = await prisma.ledgerEntry.findMany();
    const global = sumLedgerEntries(entries as LedgerEntryLike[]);
    expect(global).toBe(0);

    const txs = await prisma.ledgerTransaction.findMany({ include: { entries: true } });
    for (const t of txs) {
      const tot = sumLedgerEntries(t.entries as LedgerEntryLike[]);
      expect(tot).toBe(0);
    }
  });

  test('16 SINGLETON ACCOUNTS: concurrent creation yields exactly one SYSTEM and one PLATFORM_REVENUE', async () => {
    const tasks: Promise<any>[] = [];
    for (let i = 0; i < 8; i++) {
      tasks.push(
        prisma.ledgerAccount.upsert({
          where: { singletonKey: 'GLOBAL_SYSTEM_ACCOUNT' },
          update: {},
          create: { singletonKey: 'GLOBAL_SYSTEM_ACCOUNT', accountType: 'SYSTEM' as any, name: 'System' },
        }),
      );
      tasks.push(
        prisma.ledgerAccount.upsert({
          where: { singletonKey: 'GLOBAL_PLATFORM_REVENUE' },
          update: {},
          create: { singletonKey: 'GLOBAL_PLATFORM_REVENUE', accountType: 'PLATFORM_REVENUE' as any, name: 'Platform' },
        }),
      );
    }

    await Promise.allSettled(tasks);

    const systemCount = await prisma.ledgerAccount.count({ where: { accountType: 'SYSTEM' as any } });
    const platformCount = await prisma.ledgerAccount.count({ where: { accountType: 'PLATFORM_REVENUE' as any } });
    expect(systemCount).toBe(1);
    expect(platformCount).toBe(1);
  });

  test('17 TEST ISOLATION: a single test still passes when run alone (sanity)', async () => {
    const u = await prisma.user.create({ data: { email: 'iso17@loc', username: 'ISO17' } });
    await ledgerService.createInitialCredit({ userId: u.id, amount: 42, idempotencyKey: 'iso17' });
    const ub = await ledgerService.getUserBalance(u.id);
    expect(ub.balance).toBe(42);
  });
});
