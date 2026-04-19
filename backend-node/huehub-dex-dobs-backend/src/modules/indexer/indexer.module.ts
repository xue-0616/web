import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BtcModule } from '../btc/btc.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CkbBlockEntity, DobsEntity } from '../../database/entities';
import { IndexerService } from './indexer.service';
import { IndexerDbService } from './indexer.db.service';

@Module({
        imports: [
            CommonModule,
            BtcModule,
            TypeOrmModule.forFeature([DobsEntity, CkbBlockEntity]),
        ],
        providers: [IndexerService, IndexerDbService],
        exports: [IndexerDbService],
    })
export class IndexerModule {
}
