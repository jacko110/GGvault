import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  observeQuery,
  labDiagnosticsEnabled,
} from '../common/transaction-observation';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
    if (labDiagnosticsEnabled())
      this.$use(async (params, next) => {
        const started = performance.now();
        // Fixed account categories only: never record account IDs or query arguments.
        const where =
          params.model === 'LedgerAccount' ? params.args?.where : undefined;
        const account =
          where?.singletonKey === 'GLOBAL_PLATFORM_REVENUE'
            ? 'PLATFORM_REVENUE'
            : where?.singletonKey === 'GLOBAL_SYSTEM_ACCOUNT'
              ? 'SYSTEM'
              : where?.userId_accountType
                ? 'USER_AVAILABLE'
                : where?.challengeId_accountType
                  ? 'MATCH_VAULT'
                  : undefined;
        const model = (params.model ?? 'raw') + (account ? `:${account}` : '');
        try {
          const result = await next(params);
          observeQuery(model, params.action, performance.now() - started);
          return result;
        } catch (error) {
          observeQuery(
            model,
            params.action,
            performance.now() - started,
            error instanceof Prisma.PrismaClientKnownRequestError
              ? error.code
              : 'OTHER',
          );
          throw error;
        }
      });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  async onModuleInit() {
    await this.$connect();
  }
}
