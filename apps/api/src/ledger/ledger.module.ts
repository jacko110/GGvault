import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { SettlementPolicy } from './settlement.policy';

@Module({
  controllers: [LedgerController],
  providers: [LedgerService, SettlementPolicy],
  exports: [LedgerService],
})
export class LedgerModule {}
