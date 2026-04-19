import { HttpStatus, Logger, UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiTransformInterceptor } from './common/interceptors/api-transform.interceptor';
import { setupSwagger } from './setup-swagger';
import { LoggerService } from './shared/logger/logger.service';
import { SocketIoAdapter } from './modules/ws/socket-io.adapter';

const SERVER_PORT = process.env.SERVER_PORT;
async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        bufferLogs: true,
    });
    app.enableCors({
        origin: process.env.CORS_ORIGINS?.split(',') || [],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    });
    // Security: Register Fastify helmet for HTTP security headers
    await app.register(require('@fastify/helmet'), {
        contentSecurityPolicy: false, // Disable CSP for Swagger UI compatibility
    });
    // Security: Register Fastify rate limiting
    await app.register(require('@fastify/rate-limit'), {
        max: 100,
        timeWindow: '1 minute',
    });
    app.useLogger(app.get(LoggerService));
    app.useGlobalPipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        exceptionFactory: (errors) => {
            return new UnprocessableEntityException(errors
                .filter((item) => !!item.constraints)
                .flatMap((item) => Object.values(item.constraints ?? {}))
                .join('; '));
        },
    }));
    app.useGlobalFilters(new ApiExceptionFilter(app.get(LoggerService)));
    app.useGlobalInterceptors(new ApiTransformInterceptor(new Reflector()));
    app.useWebSocketAdapter(new SocketIoAdapter(app, app.get(ConfigService)));
    setupSwagger(app);
    await app.listen(Number(SERVER_PORT ?? 3000), '0.0.0.0');
    const serverUrl = await app.getUrl();
    Logger.log(`api服务已经启动,请访问: ${serverUrl}`);
    Logger.log(`API文档已生成,请访问: ${serverUrl}/${process.env.SWAGGER_PATH}/`);
    Logger.log(`ws服务已经启动,请访问: http://localhost:${process.env.WS_PORT}${process.env.WS_PATH}`);
}
bootstrap();
