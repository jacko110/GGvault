import {
  CanActivate,
  ExecutionContext,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { createClient } from 'redis';
import { AuthRequest } from './auth.guard';
import { fail } from '../common/domain';
import { betaConfig } from '../common/beta-config';

/** Actor + controller + action: identifiers and spoofed forwarding headers cannot evade it. */
@Injectable()
export class MutationThrottleGuard implements CanActivate, OnModuleDestroy {
  private readonly client = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    socket: { reconnectStrategy: false, connectTimeout: 2000 },
  });
  private connecting?: Promise<unknown>;
  private readonly limit = betaConfig().mutationLimit;
  constructor() {
    this.client.on('error', () => undefined);
  }
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    if (!req.user || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method))
      return true;
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
          {
            keys: [
              `mutation-rate:${req.user.sub}:${ctx.getClass().name}:${ctx.getHandler().name}`,
            ],
            arguments: [],
          },
        ),
      );
      if (count > this.limit) {
        ctx.switchToHttp().getResponse().setHeader('Retry-After', '60');
        fail(429, 'RATE_LIMITED', 'Too many requests. Retry in one minute.');
      }
    } catch (error) {
      if (error instanceof Error && 'getStatus' in error) throw error;
      fail(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable.');
    }
    return true;
  }
  async onModuleDestroy() {
    if (this.client.isOpen) await this.client.quit();
  }
}
