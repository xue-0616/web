import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { initApolloConfig } from './my-apollo';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { setupSwagger } from './setup-swagger';
import { HttpExceptionFilter } from './filters/entity.exception.filter';
import { CommonModule } from './common/common.module';
import { AppLoggerService } from './common/utils-service/logger.service';
import { AppConfigService } from './common/utils-service/app.config.services';
import { ErrorExceptionFilter } from './filters/error.exception.filter';

async function bootstrap() {
  await initApolloConfig();
  const app = await NestFactory.create(AppModule, new ExpressAdapter());

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [],
    methods: ['GET', 'POST'],
  });

  // Enhanced validation pipe with strict security settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error on non-whitelisted properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: false, // Require explicit type decorators
      },
    }),
  );

  const reflector = app.get(Reflector);
  const loggerService = await app
    .select(CommonModule)
    .resolve(AppLoggerService);
  loggerService.setContext(`Main`);

  app.useGlobalFilters(
    new HttpExceptionFilter(reflector, loggerService),
    new ErrorExceptionFilter(reflector, loggerService),
  );

  app.setGlobalPrefix('api/v1');

  const configService = app.select(CommonModule).get(AppConfigService);
  if (configService.enabledDocumentation) {
    await setupSwagger(app);
    loggerService.log('document path /docs');
  }

  await app.listen(AppModule.port || 3000);
  return app;
}

bootstrap();
