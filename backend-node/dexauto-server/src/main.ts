import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as packageJson from '../package.json';
import { config as dotenvConfig } from 'dotenv';
import { Logger } from 'nestjs-pino';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
    dotenvConfig({
        path: `${process.env.NODE_ENV}.env`,
    });
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    const port = configService.get('port');
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(new ValidationPipe());
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : [];
    app.enableCors({
        origin: allowedOrigins.length > 0 ? allowedOrigins : false,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
        exposedHeaders: ['Content-Length'],
    });
    const appVersion = packageJson.version;
    // M-3: Only expose Swagger docs in non-production environments
    if (process.env.NODE_ENV !== 'production') {
        const swaggerConfig = new DocumentBuilder()
            .setTitle('trading server')
            .setVersion(appVersion)
            .addBearerAuth()
            .build();
        const document = SwaggerModule.createDocument(app, swaggerConfig);
        SwaggerModule.setup('api-docs', app, document);
    }
    app.enableShutdownHooks();
    await app.listen(port);
}
bootstrap();
