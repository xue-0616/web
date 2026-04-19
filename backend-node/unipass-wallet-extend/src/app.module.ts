import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { healthCheck } from './common/graphql/health-check';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { ApiConfigService } from './common/api-config.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccountModule } from './account/account.module';
import { ApiModule } from './api/api.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { GqlThrottlerGuard } from './common/graphql/gql-throttler-guard.guard';

@Module({
        imports: [
            ConfigModule.forRoot({
                envFilePath: '.env',
                isGlobal: true,
                cache: true,
            }),
            ScheduleModule.forRoot(),
            GraphQLModule.forRoot({
                context: ({ req }: { req: unknown }) => req,
                autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
                sortSchema: true,
                onHealthCheck: (req: unknown) => {
                    return healthCheck(req);
                },
            }),
            TypeOrmModule.forRootAsync({
                imports: [CommonModule],
                name: 'mainnet',
                useFactory: (configService) => configService.mysqlMainnetConfig,
                inject: [ApiConfigService],
            }),
            TypeOrmModule.forRootAsync({
                imports: [CommonModule],
                name: 'testnet',
                useFactory: (configService) => configService.mysqlTestNetConfig,
                inject: [ApiConfigService],
            }),
            ThrottlerModule.forRoot({
                ttl: 60,
                limit: 120,
            }),
            CommonModule,
            AccountModule,
            ApiModule,
        ],
        controllers: [AppController],
        providers: [
            AppService,
            {
                provide: APP_GUARD,
                useClass: GqlThrottlerGuard,
            },
        ],
    })
export class AppModule {
    constructor(private readonly _config: ConfigService) {
        AppModule.port = AppModule.normalizePort(_config.get('PORT'));
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
