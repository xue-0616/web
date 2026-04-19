import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PositionManagerService } from './position-manager.service';
import { FundAllocatorService } from './fund-allocator';
import { EntryDeviationMonitorService } from './entry-deviation-monitor';
import { DailyLossCircuitBreakerService } from './daily-loss-circuit-breaker.service';
import { PositionReanchorGlueService } from './position-reanchor-glue.service';
import { PositionMonitorModule } from '../position-monitor/position-monitor.module';
import { AdminRiskController } from './admin-risk.controller';

@Module({
  imports: [ConfigModule, PositionMonitorModule],
  controllers: [AdminRiskController],
  providers: [
    PositionManagerService,
    FundAllocatorService,
    EntryDeviationMonitorService,
    DailyLossCircuitBreakerService,
    PositionReanchorGlueService,
  ],
  exports: [
    PositionManagerService,
    FundAllocatorService,
    EntryDeviationMonitorService,
    DailyLossCircuitBreakerService,
  ],
})
export class PositionManagerModule {}
