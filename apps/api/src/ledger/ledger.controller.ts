import { Controller, Get, Param, Query } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { CurrentUser, Identity } from '../auth/auth.guard';
import { fail } from '../common/domain';
import { PrismaService } from '../database/prisma.service';
import { ApiBearerAuth, ApiTags, ApiResponse } from '@nestjs/swagger';
import { TransactionQuery, TransactionPageResponse } from './transactions.dto';

@Controller()
@ApiTags('Ledger')
@ApiBearerAuth()
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly db: PrismaService,
  ) {}

  @Get('users/me/transactions')
  @ApiResponse({ status: 200, type: TransactionPageResponse })
  transactions(
    @CurrentUser() actor: Identity,
    @Query() query: TransactionQuery,
  ) {
    return this.ledgerService.history(actor.sub, query.cursor, query.limit);
  }

  @Get('users/:userId/balance')
  getUserBalance(
    @Param('userId') userId: string,
    @CurrentUser() user: Identity,
  ) {
    if (userId !== user.sub)
      fail(403, 'AUTH_FORBIDDEN', 'You can only read your own balance.');
    return this.ledgerService.getUserBalance(userId);
  }

  @Get('users/:userId/ledger')
  getUserLedger(
    @Param('userId') userId: string,
    @CurrentUser() user: Identity,
  ) {
    if (userId !== user.sub)
      fail(403, 'AUTH_FORBIDDEN', 'You can only read your own ledger.');
    return this.ledgerService.getUserLedger(userId);
  }

  @Get('challenges/:challengeId/vault')
  async getChallengeVault(
    @Param('challengeId') challengeId: string,
    @CurrentUser() user: Identity,
  ) {
    const participant = await this.db.challengePlayer.findUnique({
      where: { challengeId_userId: { challengeId, userId: user.sub } },
    });
    if (!participant)
      fail(
        403,
        'CHALLENGE_NOT_PARTICIPANT',
        'Only participants can read this vault.',
      );
    return this.ledgerService.getChallengeVault(challengeId);
  }
}
