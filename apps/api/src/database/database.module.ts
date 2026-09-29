import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: 'PRISMA_CLIENT',
      useExisting: PrismaService,
    },
  ],
  exports: ['PRISMA_CLIENT', PrismaService],
})
export class DatabaseModule {}
