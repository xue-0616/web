import './polyfill';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
 import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import getConfiguration from './config/configuration';
import { AdminModule } from './modules/admin/admin.module';
 import { AuthGuard } from './modules/admin/core/guards/auth.guard';
import { UnipassModule } from './modules/unipass/unipass.module';
import { WSModule } from './modules/ws/ws.module';
import { LoggerModule } from './shared/logger/logger.module';
import { LoggerModuleOptions } from './shared/logger/logger.interface';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [getConfiguration],
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): LoggerModuleOptions => ({
        level: configService.get<string>('logger.level') as any,
        consoleLevel: configService.get<string>('logger.consoleLevel') as any,
        timestamp: configService.get<boolean>('logger.timestamp'),
        maxFiles: Number(configService.get<string>('logger.maxFiles') || 0) || undefined,
        maxFileSize: configService.get<string>('logger.maxFileSize'),
        disableConsoleAtProd: configService.get<boolean>('logger.disableConsoleAtProd'),
        dir: configService.get<string>('logger.dir'),
        errorLogName: configService.get<string>('logger.errorLogName'),
        appLogName: configService.get<string>('logger.appLogName'),
      }),
      inject: [ConfigService],
    }, true),
    TypeOrmModule.forRootAsync({
      name: 'default',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...(configService.get('database') || {}),
        name: 'default',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      name: 'UniPass_db',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...(configService.get('unipass_database') || {}),
        name: 'UniPass_db',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      name: 'Relayer_db',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...(configService.get('relayer_database') || {}),
        name: 'Relayer_db',
      }),
      inject: [ConfigService],
    }),
    AdminModule,
    UnipassModule,
    WSModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
