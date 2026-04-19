import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from './common/utils-service/app.config.services';
import { APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { TgUserModule } from './modules/tg-user/tg-user.module';
import { BlinkModule } from './modules/blink/blink.module';

import { ConfigModule } from '@nestjs/config';
import { VERSION_V1 } from './common/utils/const.config';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        ConfigModule.forRoot({
            envFilePath: '.env',
            isGlobal: true,
            cache: true,
        }),
        TypeOrmModule.forRootAsync({
            imports: [CommonModule],
            useFactory: (configService: AppConfigService) => configService.mysqlConfig as any,
            inject: [AppConfigService],
        }),
        RedisModule.forRootAsync({
            imports: [CommonModule],
            useFactory: (configService: AppConfigService) => configService.redisConfig,
            inject: [AppConfigService],
        }),
        BullModule.forRootAsync({
            imports: [CommonModule],
            useFactory: (configService: AppConfigService) => configService.queueConfig,
            inject: [AppConfigService],
        }),
        RouterModule.register([
            {
                path: VERSION_V1,
                children: [TgUserModule, BlinkModule],
            },
        ]),
        CommonModule,
        HealthCheckerModule,
        TgUserModule,
        BlinkModule,
    ],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor,
        },
    ],
})
export class AppModule {
    static port: number;
    static isDev: boolean;
    static globalPrefix: string;

    constructor(private readonly _config: ConfigService) {
        AppModule.port = AppModule.normalizePort(_config.get('port'));
        const envType = process.env.NODE_ENV || 'development';
        AppModule.isDev = envType === 'development';
        AppModule.globalPrefix = _config.get('globalPrefix') || '';
    }
    static normalizePort(val: any) {
        const port = typeof val === 'string' ? parseInt(val, 10) : val;
        if (Number.isNaN(port)) {
            return val;
        }
        if (port >= 0) {
            return port;
        }
        throw new Error(`Port "${val}" is invalid.`);
    }
}
