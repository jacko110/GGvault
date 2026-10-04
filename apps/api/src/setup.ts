import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './common/domain';
import * as validatorPackage from 'class-validator';
import { requestObservation } from './common/observability';
import { betaConfig } from './common/beta-config';

export function configureApp(app: INestApplication) {
  betaConfig();
  app.use(requestObservation);
  app.useGlobalPipes(
    new ValidationPipe({
      // Resolve the API workspace's validator, even when Nest is hoisted at the repo root.
      validatorPackage,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  const config = new DocumentBuilder()
    .setTitle('GGVault Phase 5')
    .setDescription(
      'Non-withdrawable TEST credits. Private matches, immutable evidence, automatic verified settlement and moderator dispute resolution. No player settlement endpoint or real money.',
    )
    .setVersion('0.5')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
