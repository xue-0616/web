// Recovered from dist/main.js.map (source: ../src/main.ts)

import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, HttpStatus, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/bad-request.filter';
import { HttpErrorExceptionFilter } from './filters/http-error.filter';
import { ApiConfigService, AppLoggerService } from './shared/services';

const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

async function bootstrap() {
    const app: any = await NestFactory.create(AppModule);
    app.enable('trust proxy');
    app.use(helmet());
    const configService = app.get(ApiConfigService);
    const rateLimit = (configService as any).appConfig?.rateLimit || 100;
    app.use(compression());
    app.use(morgan('combined'));
    app.enableVersioning();
    const reflector = app.get(Reflector);
    const loggerService = await app.resolve(AppLoggerService);
    app.useGlobalFilters(
        new HttpExceptionFilter(reflector, loggerService),
        new HttpErrorExceptionFilter(reflector, loggerService),
    );
    app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));
    app.setGlobalPrefix('/api/v1');
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
        dismissDefaultMessages: true,
        exceptionFactory: (errors: any) => new UnprocessableEntityException(errors),
    }));
    if (process.env.NODE_ENV !== 'development') {
        app.enableShutdownHooks();
    }
    const port = (configService as any).appConfig?.port || 3000;
    await app.listen(port);
    return app;
}

void bootstrap();
