// Read-only financial state fingerprint. Never prints rows, credentials or evidence.
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const { verify } = require('./ledger-invariants.cjs');
async function fingerprint(db) {
  return db.$transaction(
    async (tx) => {
      const state = {};
      for (const table of [
        'ledgerAccount',
        'ledgerEntry',
        'ledgerTransaction',
        'challenge',
        'challengePlayer',
        'match',
        'matchParticipant',
        'matchResult',
        'dispute',
        'evidence',
      ])
        state[table] = await tx[table].findMany({ orderBy: { id: 'asc' } });
      return createHash('sha256').update(JSON.stringify(state)).digest('hex');
    },
    { isolationLevel: 'RepeatableRead', timeout: 30000 },
  );
}
if (require.main === module) {
  const db = new PrismaClient();
  (async () => {
    const hash = await fingerprint(db),
      invariant = await verify(db);
    console.log(JSON.stringify({ hash, invariant }));
    if (!invariant.ok) process.exitCode = 1;
  })()
    .catch(() => {
      console.error('State verification failed');
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
module.exports = { fingerprint };
