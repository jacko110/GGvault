import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from './database/prisma.service';

class GameCatalogResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

@Controller('games')
@ApiTags('Games')
@ApiBearerAuth()
export class GamesController {
  constructor(private readonly db: PrismaService) {}
  @Get()
  @ApiResponse({ status: 200, type: GameCatalogResponse, isArray: true })
  list() {
    return this.db.game.findMany({
      where: { enabled: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }
}
