import { initApolloConfig } from './my-apollo';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { HttpStatus, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AppLoggerService } from './common/utils-service/logger.service';
import { HttpExceptionFilter } from './filters/entity.exception.filter';
import { HttpErrorExceptionFilter } from './filters/bad.request.exception.filter';
import { ErrorExceptionFilter } from './filters/error.exception.filter';
import { AppConfigService } from './common/utils-service/app.config.services';
import { setupSwagger } from './setup-swagger';

async function bootstrap() {
    await initApolloConfig();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(), { cors: true });
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        transform: true,
        dismissDefaultMessages: true,
        exceptionFactory: (errors) => new UnprocessableEntityException(errors),
    }));
    const reflector = app.get(Reflector);
    const loggerService = await app
        .select(CommonModule)
        .resolve(AppLoggerService);
    loggerService.setContext(`Main`);
    app.useGlobalFilters(new HttpExceptionFilter(reflector, loggerService), new HttpErrorExceptionFilter(reflector, loggerService), new ErrorExceptionFilter(reflector, loggerService));
    app.setGlobalPrefix('huehub');
    const configService = app.select(CommonModule).get(AppConfigService);
    if (configService.enabledDocumentation) {
        await setupSwagger(app);
        loggerService.log('document path /docs');
    }
    await app.listen(AppModule.port || 3000);
    return app;
}
bootstrap();
