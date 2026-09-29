import { ApiResponse } from '@nestjs/swagger';
import {
  ErrorResponse,
  ChallengeResponse,
  ChallengePageResponse,
  FundingResponse,
} from '../common/responses.dto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Identity } from '../auth/auth.guard';
import { EmptyDto } from '../auth/auth.dto';
import { IdDto } from '../users/users.dto';
import { ChallengesService } from './challenges.service';
import { CreateChallengeDto, DiscoverDto } from './challenges.dto';

@ApiTags('Challenges')
@ApiBearerAuth()
@Controller('challenges')
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
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}
  @Post()
  @ApiResponse({ status: 201, type: ChallengeResponse, isArray: false })
  create(@CurrentUser() user: Identity, @Body() dto: CreateChallengeDto) {
    return this.challenges.create(user.sub, dto);
  }
  @Get()
  @ApiResponse({ status: 200, type: ChallengePageResponse, isArray: false })
  discover(@Query() dto: DiscoverDto) {
    return this.challenges.discover(dto);
  }
  @Get(':id')
  @ApiResponse({ status: 200, type: ChallengeResponse, isArray: false })
  detail(@Param() params: IdDto) {
    return this.challenges.detail(params.id);
  }
  @Post(':id/join')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ChallengeResponse, isArray: false })
  join(
    @CurrentUser() user: Identity,
    @Param() params: IdDto,
    @Body() _dto: EmptyDto,
  ) {
    void _dto;
    return this.challenges.join(user.sub, params.id);
  }
  @Post(':id/cancel')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ChallengeResponse, isArray: false })
  cancel(
    @CurrentUser() user: Identity,
    @Param() params: IdDto,
    @Body() _dto: EmptyDto,
  ) {
    void _dto;
    return this.challenges.cancel(user.sub, params.id);
  }
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique client operation ID, 8–128 letters/digits/:/_/-. Retries must use the same key.',
  })
  @Post(':id/fund')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: FundingResponse, isArray: false })
  fund(
    @CurrentUser() user: Identity,
    @Param() params: IdDto,
    @Headers('idempotency-key') key: string | undefined,
    @Body() _dto: EmptyDto,
  ) {
    void _dto;
    return this.challenges.fund(user.sub, params.id, key);
  }
}
