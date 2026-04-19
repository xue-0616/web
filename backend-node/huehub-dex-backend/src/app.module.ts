import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { AppConfigService } from './common/utils-service/app.config.services';
import { RedisModule } from '@nestjs-modules/ioredis';
import { APP_GUARD, APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { VERSION_V1 } from './common/utils/const.config';
import { UserModule } from './modules/user/user.module';
import { BtcModule } from './modules/btc/btc.module';
import { RgbppModule } from './modules/rgbpp/rgbpp.module';
import { ExternalModule } from './modules/external/external.module';
import { BullModule } from '@nestjs/bull';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { AuthModule } from './auth/auth.module';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { JwtGuard } from './auth/auth.guard';

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
            RouterModule.register([
                {
                    path: VERSION_V1,
                    children: [UserModule, BtcModule, RgbppModule, ExternalModule],
                },
            ]),
            BullModule.forRootAsync({
                imports: [CommonModule],
                useFactory: (configService) => configService.queueConfig,
                inject: [AppConfigService],
            }),
            CommonModule,
            HealthCheckerModule,
            UserModule,
            AuthModule,
            BtcModule,
            RgbppModule,
            ExternalModule,
        ],
        providers: [
            {
                provide: APP_INTERCEPTOR,
                useClass: TransformInterceptor,
            },
            {
                provide: APP_GUARD,
                useClass: JwtGuard,
            },
        ],
    })
export class AppModule {
    constructor(private readonly _config: ConfigService) {
        AppModule.port = AppModule.normalizePort(_config.get('port'));
        const envType = process.env.NODE_ENV || 'development';
        AppModule.isDev = envType === 'development';
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
