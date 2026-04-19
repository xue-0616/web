import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BtcModule } from '../btc/btc.module';
import { MarketModule } from '../market/market.module';
import { IndexerModule } from '../indexer/indexer.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionEntity, StatisticEntity } from '../../database/entities';
import { DobsController } from './collection.controller';
import { CollectionDbService, StatisticDbService } from './db.service';
import { CollectionService } from './collection.service';
import { StatisticService } from './statisics.service';

@Module({
        imports: [
            CommonModule,
            BtcModule,
            MarketModule,
            IndexerModule,
            TypeOrmModule.forFeature([CollectionEntity, StatisticEntity]),
        ],
        controllers: [DobsController],
        providers: [
            CollectionDbService,
            StatisticDbService,
            CollectionService,
            StatisticService,
        ],
        exports: [CollectionDbService, StatisticService],
    })
export class CollectionModule {
}
