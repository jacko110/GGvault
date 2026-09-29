import { Injectable } from '@nestjs/common';
import { createHealthStatus } from '@ggvault/shared';

@Injectable()
export class AppService {
  getHealth() {
    return createHealthStatus('ggvault-api');
  }
}
