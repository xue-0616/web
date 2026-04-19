import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BacktestService } from './backtest.service';

@Module({
  imports: [ConfigModule],
  providers: [BacktestService],
  exports: [BacktestService],
})
export class BacktestModule {}
