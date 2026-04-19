import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomaticStrategy } from '../automatic-strategy/entities/AutomaticStrategy.entity';
import { AutomaticStrategyEvent } from '../automatic-strategy/entities/AutomaticStrategyEvent.entity';
import { AutomaticStrategyEventTx } from '../automatic-strategy/entities/AutomaticStrategyEventTx.entity';
import { TradingOrder } from '../trading/entities/tradingOrder.entity';
import { WalletOrderStatistic } from '../wallet/entities/walletOrderStatistic.entity';
import { TradingSetting } from '../trading/entities/tradingSetting.entity';
import { AutomaticStrategySyncerService } from './automatic-strategy-syncer.service';
import { TokenModule } from '../token/token.module';
import { TokenSecurityModule } from '../token-security/token-security.module';
import { WalletScorerModule } from '../wallet-scorer/wallet-scorer.module';
import { MessageNotifierModule } from '../message-notifier/message-notifier.module';
import { SmartWalletSourceModule } from '../smart-wallet-source/smart-wallet-source.module';
import { PositionManagerModule } from '../position-manager/position-manager.module';
import { SocialSignalModule } from '../social-signal/social-signal.module';
import { TradingModule } from '../trading/trading.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AutomaticStrategy,
            AutomaticStrategyEvent,
            AutomaticStrategyEventTx,
            TradingOrder,
            WalletOrderStatistic,
            TradingSetting,
        ]),
        ConfigModule,
        ScheduleModule.forRoot(),
        TokenModule,
        TokenSecurityModule,
        MessageNotifierModule,
        WalletScorerModule,
        PositionManagerModule,
        SocialSignalModule,
        TradingModule,
        forwardRef(() => SmartWalletSourceModule),
    ],
    providers: [AutomaticStrategySyncerService],
    exports: [AutomaticStrategySyncerService],
})
export class AutomaticStrategySyncerModule {}
