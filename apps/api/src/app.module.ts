import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { HealthModule } from './health/health.module';
import { LedgerModule } from './ledger/ledger.module';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './users/users.controller';
import { ChallengesController } from './challenges/challenges.controller';
import { ChallengesService } from './challenges/challenges.service';

@Module({
  imports: [DatabaseModule, HealthModule, LedgerModule, AuthModule],
  controllers: [AppController, UsersController, ChallengesController],
  providers: [AppService, DatabaseService, ChallengesService],
})
export class AppModule {}
