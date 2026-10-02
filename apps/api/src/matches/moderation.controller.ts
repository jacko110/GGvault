import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Identity, Roles } from '../auth/auth.guard';
import { ErrorResponse } from '../common/responses.dto';
import { IdDto } from '../users/users.dto';
import { DisputeQuery, ResolveDisputeDto } from './moderation.dto';
import { ModerationService } from './moderation.service';
import {
  DisputePageResponse,
  DisputeDetailResponse,
  ResolutionResponse,
} from './moderation.responses';

@Controller('moderation/disputes')
@ApiTags('Moderation')
@ApiBearerAuth()
@Roles('MODERATOR', 'ADMIN')
@ApiResponse({ status: 400, type: ErrorResponse })
@ApiResponse({ status: 401, type: ErrorResponse })
@ApiResponse({ status: 403, type: ErrorResponse })
@ApiResponse({ status: 404, type: ErrorResponse })
@ApiResponse({ status: 409, type: ErrorResponse })
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiResponse({ status: 200, type: DisputePageResponse })
  list(@CurrentUser() actor: Identity, @Query() query: DisputeQuery) {
    return this.moderation.list(actor, query);
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @ApiResponse({ status: 200, type: DisputeDetailResponse })
  detail(@Param() params: IdDto, @CurrentUser() actor: Identity) {
    return this.moderation.detail(params.id, actor);
  }
  @Post(':id/resolve')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ResolutionResponse })
  resolve(
    @Param() params: IdDto,
    @CurrentUser() actor: Identity,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.moderation.resolve(params.id, actor, dto);
  }
}
