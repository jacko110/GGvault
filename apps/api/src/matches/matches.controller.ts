import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Header,
  HttpCode,
  Injectable,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthRequest, CurrentUser, Identity } from '../auth/auth.guard';
import { EmptyDto } from '../auth/auth.dto';
import { IdDto } from '../users/users.dto';
import { ErrorResponse } from '../common/responses.dto';
import { MatchesService } from './matches.service';
import {
  DisputeDto,
  EvidenceDto,
  EvidenceParams,
  ResultDto,
} from './matches.dto';
import { EvidenceService } from './evidence.service';
import { EvidenceUpload } from './evidence.policy';
import { PrismaService } from '../database/prisma.service';
import {
  MatchRoomResponse,
  ReadyResponse,
  ResultResponse,
  DecisionResponse,
  EvidenceResponse,
  TimelineResponse,
} from './matches.responses';

@Injectable()
export class EvidenceUploadGuard implements CanActivate {
  constructor(
    private readonly matches: MatchesService,
    private readonly db: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    await this.matches.access(this.db, String(req.params.id), req.user, true);
    return true;
  }
}

@ApiTags('Matches')
@ApiBearerAuth()
@Controller('matches')
@ApiResponse({ status: 400, type: ErrorResponse })
@ApiResponse({ status: 401, type: ErrorResponse })
@ApiResponse({ status: 403, type: ErrorResponse })
@ApiResponse({ status: 404, type: ErrorResponse })
@ApiResponse({ status: 409, type: ErrorResponse })
@ApiResponse({ status: 413, type: ErrorResponse })
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly evidence: EvidenceService,
  ) {}
  @Get(':id')
  @ApiResponse({ status: 200, type: MatchRoomResponse })
  detail(@Param() p: IdDto, @CurrentUser() actor: Identity) {
    return this.matches.detail(p.id, actor);
  }
  @Post(':id/ready')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: ReadyResponse })
  ready(
    @Param() p: IdDto,
    @CurrentUser() actor: Identity,
    @Body() body: EmptyDto,
  ) {
    void body;
    return this.matches.ready(p.id, actor);
  }
  @Post(':id/result')
  @ApiResponse({ status: 201, type: ResultResponse })
  submit(
    @Param() p: IdDto,
    @CurrentUser() actor: Identity,
    @Body() body: ResultDto,
  ) {
    return this.matches.submit(p.id, actor, body);
  }
  @Post(':id/result/confirm')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: DecisionResponse })
  confirm(
    @Param() p: IdDto,
    @CurrentUser() actor: Identity,
    @Body() body: EmptyDto,
  ) {
    void body;
    return this.matches.decide(p.id, actor);
  }
  @Post(':id/result/dispute')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: DecisionResponse })
  dispute(
    @Param() p: IdDto,
    @CurrentUser() actor: Identity,
    @Body() body: DisputeDto,
  ) {
    return this.matches.decide(p.id, actor, body.reason);
  }
  @Get(':id/timeline')
  @ApiResponse({ status: 200, type: TimelineResponse, isArray: true })
  timeline(@Param() p: IdDto, @CurrentUser() actor: Identity) {
    return this.matches.timeline(p.id, actor);
  }
  @Post(':id/evidence')
  @UseGuards(EvidenceUploadGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      additionalProperties: false,
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['SCREENSHOT', 'VIDEO'] },
      },
    },
  })
  @ApiResponse({ status: 201, type: EvidenceResponse })
  upload(
    @Param() p: IdDto,
    @CurrentUser() actor: Identity,
    @Body() body: EvidenceDto,
    @UploadedFile() file: EvidenceUpload | undefined,
  ) {
    return this.evidence.upload(p.id, actor, body.type, file);
  }
  @Get(':id/evidence')
  @ApiResponse({ status: 200, type: EvidenceResponse, isArray: true })
  listEvidence(@Param() p: IdDto, @CurrentUser() actor: Identity) {
    return this.evidence.list(p.id, actor);
  }
  @Get(':id/evidence/:evidenceId/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiResponse({
    status: 200,
    description:
      'Private immutable attachment; MIME restricted to JPEG/PNG/WEBP/MP4.',
    schema: { type: 'string', format: 'binary' },
  })
  async content(@Param() p: EvidenceParams, @CurrentUser() actor: Identity) {
    const { data, mime } = await this.evidence.content(
      p.id,
      p.evidenceId,
      actor,
    );
    return new StreamableFile(new Uint8Array(data), {
      type: mime,
      disposition: `attachment; filename="${p.evidenceId}"`,
      length: data.length,
    });
  }
}
