import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AutomaticStrategy } from './entities/AutomaticStrategy.entity';
import { AutomaticStrategyEvent } from './entities/AutomaticStrategyEvent.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { TradingOrder } from '../trading/entities/tradingOrder.entity';
import { AutomaticStrategyService } from './automatic-strategy.service';
import { AutomaticStrategyController } from './automatic-strategy.controller';
import { DashboardController } from './automatic-strategy-dashboard.controller';
import { AutomaticStrategySyncerModule } from '../automatic-strategy-syncer/automatic-strategy-syncer.module';
import { TokenModule } from '../token/token.module';
import { WalletScorerModule } from '../wallet-scorer/wallet-scorer.module';
import { PositionManagerModule } from '../position-manager/position-manager.module';
import { BacktestModule } from './backtest/backtest.module';
import { StrategyConfigService } from './strategy-config.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AutomaticStrategy,
            Wallet,
            AutomaticStrategyEvent,
            TradingOrder,
        ]),
        ConfigModule,
        AutomaticStrategySyncerModule,
        TokenModule,
        WalletScorerModule,
        PositionManagerModule,
        BacktestModule,
        // AuthModule exports AdminGuard which DashboardController depends on
        // for system-wide config mutation endpoints.
        AuthModule,
    ],
    controllers: [AutomaticStrategyController, DashboardController],
    providers: [AutomaticStrategyService, StrategyConfigService],
    exports: [AutomaticStrategyService, StrategyConfigService],
})
export class AutomaticStrategyModule {}
