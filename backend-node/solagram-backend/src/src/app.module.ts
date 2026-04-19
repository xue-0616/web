import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { AppConfigService } from './common/utils-service/app.config.services';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bull';
import { APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { VERSION_V1 } from './common/utils/const.parameter';
import { TgUserModule } from './modules/tg-user/tg-user.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { BlinkModule } from './modules/blink/blink.module';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { TgBotModule } from './modules/tg-bot/tg-bot.module';
import { BotStatisticsModule } from './modules/bot-statistics/bot-statistics.module';
import { TransformInterceptor } from './interceptors/transform.interceptor';

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
                useFactory: (configService) => configService.mysqlConfig,
                inject: [AppConfigService],
            }),
            RedisModule.forRootAsync({
                imports: [CommonModule],
                useFactory: (configService) => configService.redisConfig,
                inject: [AppConfigService],
            }),
            BullModule.forRootAsync({
                imports: [CommonModule],
                useFactory: (configService) => configService.queueConfig,
                inject: [AppConfigService],
            }),
            RouterModule.register([
                {
                    path: VERSION_V1,
                    children: [TgUserModule, WalletModule, BlinkModule],
                },
            ]),
            CommonModule,
            HealthCheckerModule,
            BlinkModule,
            TgBotModule,
            TgUserModule,
            WalletModule,
            BotStatisticsModule,
        ],
        providers: [
            {
                provide: APP_INTERCEPTOR,
                useClass: TransformInterceptor,
            },
        ],
    })
export class AppModule {
    constructor(private readonly _config: ConfigService) {
        AppModule.port = AppModule.normalizePort(_config.get('port'));
        const envType = process.env.NODE_ENV || 'dev';
        AppModule.isDev = envType === 'dev';
        AppModule.globalPrefix = _config.get('globalPrefix') || '';
    }
    static port: number | string;
    static isDev: boolean;
    static globalPrefix: string;
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
