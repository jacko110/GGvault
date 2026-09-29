import { Injectable } from '@nestjs/common';
import { createHealthStatus } from '@ggvault/shared';

@Injectable()
export class HealthService {
  getHealth() {
    return createHealthStatus('ggvault-api');
  }
}
