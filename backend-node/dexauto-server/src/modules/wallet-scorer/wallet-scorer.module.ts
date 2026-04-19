import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletScorerService } from './wallet-scorer.service';
import { AddressClusterService } from './address-cluster.service';
import { ExitLiquidityDetectorService } from './exit-liquidity-detector';
import { WashTradeDetectorService } from './wash-trade-detector';
import { KpiDashboardService } from './kpi-dashboard.service';
import { AIAgentDetectorService } from './ai-agent-detector.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [
    WalletScorerService,
    AddressClusterService,
    ExitLiquidityDetectorService,
    WashTradeDetectorService,
    KpiDashboardService,
    AIAgentDetectorService,
  ],
  exports: [
    WalletScorerService,
    AddressClusterService,
    ExitLiquidityDetectorService,
    WashTradeDetectorService,
    KpiDashboardService,
    AIAgentDetectorService,
  ],
})
export class WalletScorerModule {}
