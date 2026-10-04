const { PrismaClient } = require('@prisma/client');
const path = require('node:path');
const fs = require('node:fs');
const env = path.resolve(__dirname, '../.env');
if (fs.existsSync(env)) process.loadEnvFile(env);
async function verify(db) {
  return db.$transaction(
    async (tx) => {
      const transactions =
        await tx.$queryRaw`SELECT t.id, COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount::bigint ELSE -e.amount::bigint END),0) AS balance, COUNT(e.id)::int AS entries FROM ledger_transactions t LEFT JOIN ledger_entries e ON e."transactionId"=t.id GROUP BY t.id`;
      const balances =
        await tx.$queryRaw`SELECT a.id, COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount::bigint ELSE -e.amount::bigint END),0) AS balance FROM ledger_accounts a LEFT JOIN ledger_entries e ON e."ledgerAccountId"=a.id WHERE a."accountType" IN ('USER_AVAILABLE','MATCH_VAULT') GROUP BY a.id`;
      const global = transactions.reduce(
        (sum, t) => sum + BigInt(t.balance),
        0n,
      );
      const invalidTransactions = transactions.filter(
        (t) => BigInt(t.balance) !== 0n || t.entries < 2,
      ).length;
      const negativeBalances = balances.filter(
        (a) => BigInt(a.balance) < 0n,
      ).length;
      const ok =
        global === 0n && invalidTransactions === 0 && negativeBalances === 0;
      return {
        ok,
        globalConservation: global.toString(),
        transactions: transactions.length,
        invalidTransactions,
        negativeBalances,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
module.exports = { verify };
if (require.main === module) {
  const db = new PrismaClient();
  verify(db)
    .then((result) => {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: result.ok ? 'INFO' : 'CRITICAL',
          event: 'ledger_invariants',
          ...result,
        }),
      );
      if (!result.ok) process.exitCode = 1;
    })
    .catch(() => {
      console.error(
        JSON.stringify({
          level: 'CRITICAL',
          event: 'ledger_verification_failed',
        }),
      );
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
