import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { CurrentUser, Identity } from '../auth/auth.guard';
import { PrismaService } from '../database/prisma.service';
import { serializable } from '../common/domain';
import { IdDto } from '../users/users.dto';
import { MatchesService } from './matches.service';

class MyMatchesQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^c[a-z0-9]{24}$/)
  cursor?: string;
  @ApiPropertyOptional({
    enum: [
      'READY',
      'IN_PROGRESS',
      'RESULT_SUBMITTED',
      'DISPUTED',
      'SETTLED',
      'REFUNDED',
    ],
  })
  @IsOptional()
  @IsIn([
    'READY',
    'IN_PROGRESS',
    'RESULT_SUBMITTED',
    'DISPUTED',
    'SETTLED',
    'REFUNDED',
  ])
  status?:
    | 'READY'
    | 'IN_PROGRESS'
    | 'RESULT_SUBMITTED'
    | 'DISPUTED'
    | 'SETTLED'
    | 'REFUNDED';
  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
class MatchSummary {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() game!: string;
  @ApiProperty() platform!: string;
  @ApiProperty() stakeAmount!: number;
  @ApiProperty({ type: [String] }) players!: string[];
}
class MyMatchesPage {
  @ApiProperty({ type: [MatchSummary] }) items!: MatchSummary[];
  @ApiProperty({ type: String, nullable: true }) nextCursor!: string | null;
}
class RefundRead {
  @ApiProperty() userId!: string;
  @ApiProperty() amount!: number;
}
@Controller('matches')
@ApiTags('Matches')
@ApiBearerAuth()
export class MatchReadsController {
  constructor(
    private readonly db: PrismaService,
    private readonly matches: MatchesService,
  ) {}
  @Get()
  @ApiResponse({ status: 200, type: MyMatchesPage })
  async mine(@CurrentUser() actor: Identity, @Query() query: MyMatchesQuery) {
    const rows = await this.db.match.findMany({
      where: {
        participants: { some: { userId: actor.sub } },
        status: query.status,
        ...(query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: {
        id: true,
        status: true,
        createdAt: true,
        challenge: {
          select: {
            game: { select: { name: true } },
            platform: true,
            entryFee: true,
          },
        },
        participants: {
          select: { user: { select: { username: true } } },
          orderBy: { userId: 'asc' },
        },
      },
    });
    return {
      items: rows.slice(0, query.limit).map((row) => ({
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        game: row.challenge.game.name,
        platform: row.challenge.platform,
        stakeAmount: row.challenge.entryFee,
        players: row.participants.map((p) => p.user.username),
      })),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null,
    };
  }
  @Get(':id/refunds')
  @ApiResponse({ status: 200, type: RefundRead, isArray: true })
  refunds(@Param() params: IdDto, @CurrentUser() actor: Identity) {
    return serializable(this.db, async (tx) => {
      await this.matches.access(tx, params.id, actor);
      const refund = await tx.ledgerTransaction.findUnique({
        where: { matchId_type: { matchId: params.id, type: 'STAKE_REFUND' } },
        select: {
          entries: {
            where: {
              direction: 'CREDIT',
              ledgerAccount: { accountType: 'USER_AVAILABLE' },
            },
            select: {
              amount: true,
              ledgerAccount: { select: { userId: true } },
            },
          },
        },
      });
      return (
        refund?.entries.map((entry) => ({
          userId: entry.ledgerAccount.userId,
          amount: entry.amount,
        })) ?? []
      );
    });
  }
}
