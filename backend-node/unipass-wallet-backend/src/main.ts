import Compression from 'compression';
import Express_rate_limit from 'express-rate-limit';
import Helmet from 'helmet';
import Morgan from 'morgan';
import { initApolloConfig } from './my-apollo';
import { initializeTransactionalContext, patchTypeORMRepositoryWithBaseRepository } from 'typeorm-transactional-cls-hooked';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SharedModule } from './shared/shared.module';
import { ApiConfigService, AppLoggerService } from './shared/services';
import { HttpExceptionFilter } from './filters/bad-request.filter';
import { HttpErrorExceptionFilter } from './filters';
import { ClassSerializerInterceptor, HttpStatus, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import { middleware } from 'express-ctx';

export async function bootstrap() {
    await initApolloConfig();
    initializeTransactionalContext();
    patchTypeORMRepositoryWithBaseRepository();
    const app: any = await NestFactory.create(AppModule, new ExpressAdapter(), { cors: true });
    app.enable('trust proxy');
    app.use(Helmet());
    const configService = app.select(SharedModule).get(ApiConfigService);
    app.use(Express_rate_limit({
        windowMs: 1 * 60 * 1000,
        max: configService.appConfig.rateLimit,
    }));
    app.use(Compression());
    app.use(Morgan('combined'));
    app.enableVersioning();
    const reflector = app.get(Reflector);
    const loggerService = await app
        .select(SharedModule)
        .resolve(AppLoggerService);
    app.useGlobalFilters(new HttpExceptionFilter(reflector, loggerService), new HttpErrorExceptionFilter(reflector, loggerService));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
    app.setGlobalPrefix('/api/v1');
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
        dismissDefaultMessages: true,
        exceptionFactory: (errors) => new UnprocessableEntityException(errors),
    }));
    if (configService.documentationEnabled) {
        setupSwagger(app);
    }
    app.use(middleware);
    if (process.env.NODE_ENV !== 'development') {
        app.enableShutdownHooks();
    }
    const port = configService.appConfig.port;
    await app.listen(port);
    return app;
}
void bootstrap();
