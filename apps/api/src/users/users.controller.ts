import { ApiResponse } from '@nestjs/swagger';
import {
  ErrorResponse,
  UserResponse,
  GameAccountResponse,
  SuccessResponse,
} from '../common/responses.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Identity } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { audit, fail, serializable } from '../common/domain';
import { GameAccountDto, IdDto, ProfileDto } from './users.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/me')
@ApiResponse({
  status: 400,
  type: ErrorResponse,
  description: 'Validation or business error',
})
@ApiResponse({
  status: 401,
  type: ErrorResponse,
  description: 'Invalid, revoked or expired session',
})
@ApiResponse({
  status: 403,
  type: ErrorResponse,
  description: 'Insufficient permissions',
})
@ApiResponse({ status: 404, type: ErrorResponse })
@ApiResponse({
  status: 409,
  type: ErrorResponse,
  description: 'Duplicate resource or invalid state transition',
})
@ApiResponse({ status: 429, type: ErrorResponse })
export class UsersController {
  constructor(
    private readonly db: PrismaService,
    private readonly auth: AuthService,
  ) {}
  @Get()
  @ApiResponse({ status: 200, type: UserResponse, isArray: false })
  me(@CurrentUser() user: Identity) {
    return this.auth.me(user.sub);
  }
  @Patch()
  @ApiResponse({ status: 200, type: UserResponse, isArray: false })
  async update(@CurrentUser() user: Identity, @Body() dto: ProfileDto) {
    await serializable(this.db, async (tx) => {
      const { displayName, ...profile } = dto;
      await tx.user.update({
        where: { id: user.sub },
        data: {
          displayName,
          profile: { upsert: { create: profile, update: profile } },
        },
      });
      await audit(tx, user.sub, 'PROFILE_UPDATED', 'User', user.sub);
    });
    return this.auth.me(user.sub);
  }
  @Get('game-accounts')
  @ApiResponse({ status: 200, type: GameAccountResponse, isArray: true })
  accounts(@CurrentUser() user: Identity) {
    return this.db.gameAccount.findMany({
      where: { userId: user.sub },
      select: { id: true, gameId: true, platform: true, gamertag: true },
    });
  }
  @Post('game-accounts')
  @ApiResponse({ status: 201, type: GameAccountResponse, isArray: false })
  add(@CurrentUser() user: Identity, @Body() dto: GameAccountDto) {
    return serializable(this.db, async (tx) => {
      const game = await tx.game.findUnique({ where: { id: dto.gameId } });
      if (!game?.enabled) fail(400, 'GAME_UNAVAILABLE', 'Game is unavailable.');
      const account = await tx.gameAccount.create({
        data: { ...dto, userId: user.sub },
        select: { id: true, gameId: true, platform: true, gamertag: true },
      });
      await audit(
        tx,
        user.sub,
        'GAME_ACCOUNT_ADDED',
        'GameAccount',
        account.id,
      );
      return account;
    });
  }
  @Delete('game-accounts/:id')
  @ApiResponse({ status: 200, type: SuccessResponse, isArray: false })
  async remove(@CurrentUser() user: Identity, @Param() params: IdDto) {
    const result = await this.db.gameAccount.deleteMany({
      where: { id: params.id, userId: user.sub },
    });
    if (!result.count)
      fail(404, 'GAME_ACCOUNT_NOT_FOUND', 'Game account not found.');
    return { success: true };
  }
}
