import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeyserSubscriberService } from './geyser-subscriber.service';
import { FollowSellService } from './follow-sell.service';
import { BurstWalletDetectorService } from './burst-wallet-detector.service';
import { RealtimeExitLiquidityService } from './realtime-exit-liquidity.service';
import { ShredStreamPrefetchService } from './shredstream-prefetch.service';
import { AutomaticStrategySyncerModule } from '../automatic-strategy-syncer/automatic-strategy-syncer.module';
import { TokenModule } from '../token/token.module';
import { PositionMonitorModule } from '../position-monitor/position-monitor.module';
import { WalletScorerModule } from '../wallet-scorer/wallet-scorer.module';
import { SmartWalletSourceModule } from '../smart-wallet-source/smart-wallet-source.module';
import { MessageNotifierModule } from '../message-notifier/message-notifier.module';

/**
 * GeyserSubscriberModule — Yellowstone gRPC real-time data feed.
 *
 * Required environment variables:
 *   GEYSER_GRPC_ENDPOINT — Yellowstone gRPC endpoint URL
 *   GEYSER_GRPC_TOKEN — Authentication token (optional)
 *   SHREDSTREAM_GRPC_ENDPOINT — (optional) ShredStream proxy gRPC for pre-confirmation signal capture (aggressive mode)
 */
@Module({
  imports: [
    ConfigModule,
    // forwardRef — AutomaticStrategySyncerModule → SmartWalletSourceModule
    // → GeyserSubscriberModule closes a cycle; the direct import here
    // used to resolve to `undefined` during bootstrap.
    forwardRef(() => AutomaticStrategySyncerModule),
    TokenModule,
    PositionMonitorModule,
    WalletScorerModule,
    MessageNotifierModule,
    forwardRef(() => SmartWalletSourceModule),
  ],
  providers: [
    GeyserSubscriberService,
    FollowSellService,
    BurstWalletDetectorService,
    RealtimeExitLiquidityService,
    ShredStreamPrefetchService,
  ],
  exports: [
    GeyserSubscriberService,
    FollowSellService,
    BurstWalletDetectorService,
    RealtimeExitLiquidityService,
    ShredStreamPrefetchService,
  ],
})
export class GeyserSubscriberModule {}
