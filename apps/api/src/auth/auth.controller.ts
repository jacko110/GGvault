import { ApiResponse } from '@nestjs/swagger';
import {
  ErrorResponse,
  RegistrationResponse,
  TokenResponse,
  SuccessResponse,
  UserResponse,
  AccessResponse,
} from '../common/responses.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { EmptyDto, LoginDto, RefreshDto, RegisterDto } from './auth.dto';
import { CurrentUser, Identity, Public, Roles } from './auth.guard';
import { AuthThrottleGuard } from './throttle.guard';

@ApiTags('Authentication')
@Controller('auth')
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
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('register')
  @ApiResponse({ status: 201, type: RegistrationResponse, isArray: false })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('login')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: TokenResponse, isArray: false })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('refresh')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: TokenResponse, isArray: false })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: SuccessResponse, isArray: false })
  logout(@CurrentUser() user: Identity, @Body() _dto: EmptyDto) {
    void _dto;
    return this.auth.logout(user.sub, user.sessionId);
  }
  @ApiBearerAuth()
  @Get('me')
  @ApiResponse({ status: 200, type: UserResponse, isArray: false })
  me(@CurrentUser() user: Identity) {
    return this.auth.me(user.sub);
  }
  @ApiBearerAuth()
  @Roles('ADMIN', 'MODERATOR')
  @Get('moderation-access')
  @ApiResponse({ status: 200, type: AccessResponse, isArray: false })
  moderationAccess() {
    return { allowed: true };
  }
}
