import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BtcModule } from '../btc/btc.module';
import { IndexerModule } from '../indexer/indexer.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemEntity, OrderEntity } from '../../database/entities';
import { BullModule } from '@nestjs/bull';
import { QUEUE_TRANSACTION } from '../../common/utils/bull.name';
import { MarketService } from './market.service';
import { ItemsDbService, OrdersDbService } from './db.service.ts';
import { PsbtService } from './psbt.service';
import { TransactionService } from './tx.service';
import { DobsProcessor } from './processor/dobs.processor';

@Module({
        imports: [
            CommonModule,
            BtcModule,
            IndexerModule,
            TypeOrmModule.forFeature([ItemEntity, OrderEntity]),
            BullModule.registerQueue({ name: QUEUE_TRANSACTION }),
        ],
        providers: [
            MarketService,
            ItemsDbService,
            PsbtService,
            OrdersDbService,
            TransactionService,
            DobsProcessor,
        ],
        exports: [ItemsDbService, MarketService],
    })
export class MarketModule {
}
