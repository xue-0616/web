import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PositionMonitorService } from './position-monitor.service';

@Module({
  imports: [ConfigModule],
  providers: [PositionMonitorService],
  exports: [PositionMonitorService],
})
export class PositionMonitorModule {}
