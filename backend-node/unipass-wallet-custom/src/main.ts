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
import { BadHttpErrorExceptionFilter, ErrorExceptionFilter, ErrorFilter, HttpExceptionFilter, UnauthorizedExceptionFilter } from './filters';
import { ClassSerializerInterceptor, HttpStatus, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';
import { middleware } from 'express-ctx';

const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
export async function bootstrap() {
    await initApolloConfig();
    initializeTransactionalContext();
    patchTypeORMRepositoryWithBaseRepository();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(), { cors: true });
    (app as any).enable('trust proxy');
    app.use(Helmet());
    app.setGlobalPrefix('/api/v1');
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
    app.useGlobalFilters(new ErrorFilter(reflector, loggerService), new ErrorExceptionFilter(reflector, loggerService), new HttpExceptionFilter(reflector, loggerService), new BadHttpErrorExceptionFilter(reflector, loggerService), new UnauthorizedExceptionFilter(reflector, loggerService));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
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
