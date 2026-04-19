import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { initApolloConfig } from './my-apollo';
import { HttpStatus, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { setupSwagger } from './setup-swagger';
import { HttpExceptionFilter } from './filters/entity.exception.filter';
import { CommonModule } from './common/common.module';
import { AppLoggerService } from './common/utils-service/logger.service';
import { AppConfigService } from './common/utils-service/app.config.services';
import { ErrorExceptionFilter } from './filters/error.exception.filter';

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
    app.useGlobalFilters(new HttpExceptionFilter(reflector, loggerService), new ErrorExceptionFilter(reflector, loggerService));
    app.setGlobalPrefix('opentg');
    const configService = app.select(CommonModule).get(AppConfigService);
    if (configService.enabledDocumentation) {
        await setupSwagger(app);
        loggerService.log('document path /docs');
    }
    await app.listen(AppModule.port || 3000);
    return app;
}
bootstrap();
