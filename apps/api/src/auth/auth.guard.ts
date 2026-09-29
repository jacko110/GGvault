import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { fail } from '../common/domain';

export interface Identity {
  sub: string;
  role: UserRole;
  sessionId: string;
}
export interface AuthRequest extends Request {
  user: Identity;
}
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Identity =>
    ctx.switchToHttp().getRequest<AuthRequest>().user,
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const match = req.headers.authorization?.match(/^Bearer (\S+)$/);
    if (!match) fail(401, 'AUTH_REQUIRED', 'Authentication required.');
    let claims: Identity;
    try {
      claims = await this.jwt.verifyAsync<Identity>(match[1]);
    } catch {
      fail(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired access token.');
    }
    if (typeof claims.sub !== 'string' || typeof claims.sessionId !== 'string')
      fail(401, 'AUTH_INVALID_TOKEN', 'Invalid access token.');
    const session = await this.db.session.findUnique({
      where: { id: claims.sessionId },
      include: { user: true },
    });
    if (!session || session.userId !== claims.sub || session.revokedAt)
      fail(401, 'AUTH_SESSION_REVOKED', 'Session revoked.');
    if (session.expiresAt <= new Date())
      fail(401, 'AUTH_SESSION_EXPIRED', 'Session expired.');
    if (session.user.status !== 'ACTIVE')
      fail(403, 'USER_INACTIVE', 'Account is not active.');
    req.user = {
      sub: session.userId,
      sessionId: session.id,
      role: session.user.role,
    };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles) return true;
    const user = ctx.switchToHttp().getRequest<AuthRequest>().user;
    if (!user || !roles.includes(user.role))
      fail(403, 'AUTH_FORBIDDEN', 'Insufficient permissions.');
    return true;
  }
}
