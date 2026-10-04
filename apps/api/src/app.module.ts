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
import { MatchesModule } from './matches/matches.module';
import { GamesController } from './games.controller';
import { OperationsController } from './operations/operations.controller';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    LedgerModule,
    AuthModule,
    MatchesModule,
  ],
  controllers: [
    AppController,
    UsersController,
    ChallengesController,
    GamesController,
    OperationsController,
  ],
  providers: [AppService, DatabaseService, ChallengesService],
})
export class AppModule {}
