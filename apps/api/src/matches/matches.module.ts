import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MatchesService } from './matches.service';
import { MatchesController, EvidenceUploadGuard } from './matches.controller';
import { EvidenceService } from './evidence.service';
import { EvidenceStorage, LocalEvidenceStorage } from './evidence.storage';
import { EvidencePolicy, uploadLimits } from './evidence.policy';
import { LedgerModule } from '../ledger/ledger.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { MatchReadsController } from './match-reads.controller';

@Module({
  imports: [
    LedgerModule,
    MulterModule.registerAsync({
      useFactory: () => {
        const limits = uploadLimits();
        // Busboy emits partsLimit on reaching the limit; allow two actual parts plus its boundary.
        return {
          limits: {
            fileSize: Math.max(limits.screenshot, limits.video),
            files: 1,
            fields: 1,
            parts: 3,
            fieldSize: 32,
          },
        };
      },
    }),
  ],
  controllers: [MatchesController, ModerationController, MatchReadsController],
  providers: [
    MatchesService,
    ModerationService,
    EvidenceService,
    EvidencePolicy,
    EvidenceUploadGuard,
    { provide: EvidenceStorage, useClass: LocalEvidenceStorage },
  ],
})
export class MatchesModule {}
