import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  async onModuleInit() {
    await this.prisma.$connect();
  }

  getPrisma() {
    return this.prisma;
  }
}
