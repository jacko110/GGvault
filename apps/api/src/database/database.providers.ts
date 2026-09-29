import { PrismaClient } from '@prisma/client';

export const prismaProvider = {
  provide: 'PRISMA_CLIENT',
  useFactory: () => new PrismaClient(),
};
