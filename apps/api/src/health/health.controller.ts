import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/auth.guard';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }
  @Get('live')
  live() {
    return { status: 'ok' };
  }
  @Get('ready')
  ready() {
    return this.healthService.readiness();
  }
}
