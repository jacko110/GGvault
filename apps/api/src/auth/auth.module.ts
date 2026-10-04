import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LedgerModule } from '../ledger/ledger.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, RolesGuard } from './auth.guard';
import { AuthThrottleGuard } from './throttle.guard';
import { MutationThrottleGuard } from './mutation-throttle.guard';

@Global()
@Module({
  imports: [
    LedgerModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || Buffer.byteLength(secret) < 32)
          throw new Error('JWT_SECRET must contain at least 32 bytes');
        return {
          secret,
          signOptions: {
            expiresIn: '15m',
            algorithm: 'HS256',
            issuer: 'ggvault',
            audience: 'ggvault-api',
          },
          verifyOptions: {
            algorithms: ['HS256'],
            issuer: 'ggvault',
            audience: 'ggvault-api',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthThrottleGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MutationThrottleGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
