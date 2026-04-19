import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { AppConfigService } from './common/utils-service/app.config.services';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bull';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { BlinkModule } from './modules/blink/blink.module';
import { DbModule } from './modules/db/db.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { AppController } from './app.controller';

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
            CommonModule,
            HealthCheckerModule,
            TransactionModule,
            BlinkModule,
            DbModule,
        ],
        providers: [
            {
                provide: APP_INTERCEPTOR,
                useClass: TransformInterceptor,
            },
        ],
        controllers: [AppController],
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
