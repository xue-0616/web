import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './setup-swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(), { cors: true });
    app.setGlobalPrefix(AppModule.globalPrefix);
    app.useGlobalPipes(new ValidationPipe());
    setupSwagger(app);
    await app.listen(AppModule.port || 3000);
    return app;
}
bootstrap();
