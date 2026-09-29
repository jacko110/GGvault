import {
  CanActivate,
  ExecutionContext,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { createClient } from 'redis';
import { createHash } from 'crypto';
import { fail } from '../common/domain';

// Atomic shared store: each instance uses the same Redis counters. No email-based lockout.
@Injectable()
export class AuthThrottleGuard implements CanActivate, OnModuleDestroy {
  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    socket: { reconnectStrategy: false, connectTimeout: 2000 },
  });
  private connecting?: Promise<unknown>;
  constructor() {
    this.client.on('error', () => undefined);
  }
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ipHash = createHash('sha256')
      .update(req.ip ?? req.socket.remoteAddress ?? 'unknown')
      .digest('hex');
    try {
      if (!this.client.isOpen) {
        this.connecting ??= this.client.connect().finally(() => {
          this.connecting = undefined;
        });
        await this.connecting;
      }
      const count = Number(
        await this.client.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
          { keys: [`auth-rate:${ctx.getHandler().name}:${ipHash}`], arguments: [] },
        ),
      );
      if (count > 20) {
        ctx
          .switchToHttp()
          .getResponse<Response>()
          .setHeader('Retry-After', '60');
        fail(
          429,
          'AUTH_RATE_LIMITED',
          'Too many attempts. Retry in one minute.',
        );
      }
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      fail(
        503,
        'AUTH_TEMPORARILY_UNAVAILABLE',
        'Authentication temporarily unavailable.',
      );
    }
    return true;
  }
  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }
}
