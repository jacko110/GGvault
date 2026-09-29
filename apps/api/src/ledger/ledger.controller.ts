import { Controller, Get, Param } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { CurrentUser, Identity } from '../auth/auth.guard';
import { fail } from '../common/domain';
import { PrismaService } from '../database/prisma.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('Ledger')
@ApiBearerAuth()
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly db: PrismaService,
  ) {}

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
