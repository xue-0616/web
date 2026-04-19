import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AppConfigService } from './common/utils-service/app.config.services';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RouterModule } from '@nestjs/core';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymasterModule } from './modules/paymaster/paymaster.module';
import { VERSION_V1 } from './common/utils/const.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      cache: true,
    }),
    RedisModule.forRootAsync({
      imports: [CommonModule],
      useFactory: (configService: AppConfigService) => configService.redisConfig,
      inject: [AppConfigService],
    }),
    RouterModule.register([
      {
        path: VERSION_V1,
        children: [],
      },
    ]),
    CommonModule,
    HealthCheckerModule,
    PaymasterModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {
  static port: number | string;
  static isDev: boolean;
  static globalPrefix: string;

  constructor(private readonly _config: ConfigService) {
    const portValue = _config.get<string | number>('port');
    if (portValue === undefined) {
      throw new Error('PORT env var is required');
    }
    AppModule.port = AppModule.normalizePort(portValue);
    const envType = process.env.NODE_ENV || 'development';
    AppModule.isDev = envType === 'development';
    AppModule.globalPrefix = _config.get('globalPrefix') || '';
  }

  static normalizePort(val: number | string): number | string {
    const port: number = typeof val === 'string' ? parseInt(val, 10) : val;
    if (Number.isNaN(port)) {
      return val;
    }
    if (port >= 0) {
      return port;
    }
    throw new Error(`Port "${val}" is invalid.`);
  }
}
