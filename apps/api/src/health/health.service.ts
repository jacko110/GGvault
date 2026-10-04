import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHealthStatus } from '@ggvault/shared';
import { PrismaService } from '../database/prisma.service';
import { createClient } from 'redis';

@Injectable()
export class HealthService {
  constructor(private readonly db: PrismaService) {}
  getHealth() {
    return createHealthStatus('ggvault-api');
  }
  async readiness() {
    const redis = createClient({
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      socket: { connectTimeout: 1500, reconnectStrategy: false },
    });
    redis.on('error', () => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([
          this.db.$queryRaw`SELECT 1`,
          redis.connect().then(() => redis.ping()),
        ]),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Timeout')), 2000);
        }),
      ]);
      return { status: 'ok', api: 'up', postgresql: 'up', redis: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'NOT_READY',
        message: 'Required services are unavailable.',
      });
    } finally {
      clearTimeout(timer);
      if (redis.isOpen) await redis.disconnect();
    }
  }
}
