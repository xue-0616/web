// Recovered from dist/app.module.js.map (source: ../src/app.module.ts)

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { TransformInterceptor } from './interceptors';
import { ApiConfigService } from './shared/services';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { OAuth2Module } from './modules/oauth2/oauth2.module';

let SharedModule: any;
try { SharedModule = require('./shared/shared.module').SharedModule; } catch (_) {}

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
            imports: SharedModule ? [SharedModule] : [],
            useFactory: (configService: ApiConfigService) => (configService as any).mysqlConfig,
            inject: [ApiConfigService],
        }),
        BullModule.forRootAsync({
            useFactory: (configService: ApiConfigService) => (configService as any).queueConfig,
            inject: [ApiConfigService],
        }),
        HealthCheckerModule,
        OAuth2Module,
    ],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor,
        },
    ],
})
export class AppModule {}
