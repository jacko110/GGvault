import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.game.upsert({ where: { slug: 'fc-26' }, update: { name: 'FC 26', enabled: true }, create: { slug: 'fc-26', name: 'FC 26', enabled: true } });
}
main().catch(() => { console.error('Seed failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
