import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';

import configuration from './config/configuration';
import redisConfig from './config/redis.config';
import databaseConfig from './config/database.config';
import clickhouseConfig from './config/clickhouse.config';

import { RedisModule } from './modules/redis/redis.module';
import { ClickHouseModule } from './infrastructure/clickhouse/clickhouse.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { TokenModule } from './modules/token/token.module';
import { TradingModule } from './modules/trading/trading.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { MessageNotifierModule } from './modules/message-notifier/message-notifier.module';
import { AutomaticStrategyModule } from './modules/automatic-strategy/automatic-strategy.module';
import { AutomaticStrategySyncerModule } from './modules/automatic-strategy-syncer/automatic-strategy-syncer.module';
import { TransferSubscriberModule } from './modules/transfer-subscriber/transfer-subscriber.module';
import { TransferSyncerModule } from './modules/transfer-syncer/transfer-syncer.module';
import { StreamModule } from './modules/stream/stream.module';
import { KmsModule } from './modules/kms/kms.module';
import { TokenSecurityModule } from './modules/token-security/token-security.module';
import { PositionMonitorModule } from './modules/position-monitor/position-monitor.module';
// Phase 2-4: Smart Money Upgrade modules
import { GeyserSubscriberModule } from './modules/geyser-subscriber/geyser-subscriber.module';
import { WalletScorerModule } from './modules/wallet-scorer/wallet-scorer.module';
import { PositionManagerModule } from './modules/position-manager/position-manager.module';
import { SmartWalletSourceModule } from './modules/smart-wallet-source/smart-wallet-source.module';
import { SocialSignalModule } from './modules/social-signal/social-signal.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [configuration, redisConfig, databaseConfig, clickhouseConfig],
            ignoreEnvFile: true,
        }),
        LoggerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => {
                const logFormat = config.get<string>('logFormat', 'pretty');
                return {
                    pinoHttp: {
                        transport:
                            logFormat === 'pretty'
                                ? { target: 'pino-pretty', options: { destination: process.stdout.fd } }
                                : undefined,
                    },
                };
            },
        }),
        TypeOrmModule.forRootAsync(databaseConfig.asProvider() as any),
        ScheduleModule.forRoot(),
        // Global modules
        RedisModule,
        ClickHouseModule,
        // Feature modules
        AuthModule,
        UserModule,
        WalletModule,
        TokenModule,
        TradingModule,
        FavoriteModule,
        MessageNotifierModule,
        AutomaticStrategyModule,
        AutomaticStrategySyncerModule,
        TransferSubscriberModule,
        TransferSyncerModule,
        StreamModule,
        KmsModule,
        TokenSecurityModule,
        PositionMonitorModule,
        // Phase 2-4: Smart Money Upgrade
        GeyserSubscriberModule,
        WalletScorerModule,
        PositionManagerModule,
        SmartWalletSourceModule,
        SocialSignalModule,
    ],
})
export class AppModule {}
