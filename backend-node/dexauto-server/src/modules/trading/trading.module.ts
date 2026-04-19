import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TradingSetting } from './entities/tradingSetting.entity';
import { TradingStrategy } from './entities/tradingStrategy.entity';
import { TradingStrategyItem } from './entities/tradingStrategyItem.entity';
import { TradingOrder } from './entities/tradingOrder.entity';
import { WalletOrderStatistic } from '../wallet/entities/walletOrderStatistic.entity';
import { AutomaticStrategy } from '../automatic-strategy/entities/AutomaticStrategy.entity';
import { AutomaticStrategyEvent } from '../automatic-strategy/entities/AutomaticStrategyEvent.entity';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { TokenModule } from '../token/token.module';
import { WalletModule } from '../wallet/wallet.module';
import { MessageNotifierModule } from '../message-notifier/message-notifier.module';
import { PositionMonitorModule } from '../position-monitor/position-monitor.module';
import { PriorityFeeOracleService } from './priority-fee-oracle.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            TradingSetting,
            TradingStrategy,
            TradingStrategyItem,
            TradingOrder,
            WalletOrderStatistic,
            AutomaticStrategy,
            AutomaticStrategyEvent,
        ]),
        ConfigModule,
        TokenModule,
        WalletModule,
        MessageNotifierModule,
        PositionMonitorModule,
    ],
    controllers: [TradingController],
    providers: [TradingService, PriorityFeeOracleService],
    exports: [TradingService, PriorityFeeOracleService],
})
export class TradingModule {}
