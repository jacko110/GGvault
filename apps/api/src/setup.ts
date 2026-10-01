import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './common/domain';
import * as validatorPackage from 'class-validator';

export function configureApp(app: INestApplication) {
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
    .setTitle('GGVault Phase 4')
    .setDescription(
      'Non-withdrawable TEST credits. Challenge funding, private matches, results and immutable evidence. No public settlement.',
    )
    .setVersion('0.4')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
