import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PositionManagerService } from './position-manager.service';
import { PositionMonitorService } from '../position-monitor/position-monitor.service';

/**
 * Glue service that wires PositionManagerService → PositionMonitorService
 * at bootstrap time without creating a circular DI dependency.
 *
 * When an add-buy re-averages an existing position, PositionManagerService
 * fires `onAddBuyCallback`, which this glue forwards to PositionMonitorService
 * to reanchor entry price + reset Batch TP/SL flags.
 */
@Injectable()
export class PositionReanchorGlueService implements OnModuleInit {
  private readonly logger = new Logger(PositionReanchorGlueService.name);

  constructor(
    private readonly positionManager: PositionManagerService,
    private readonly positionMonitor: PositionMonitorService,
  ) {}

  onModuleInit(): void {
    this.positionManager.registerOnAddBuyCallback(async (orderId, newEntryUsd) => {
      await this.positionMonitor.reanchorPositionOnAddBuy(orderId, newEntryUsd);
    });
    this.logger.log('Position reanchor glue wired: add-buy → Batch TP/SL reset');
  }
}
