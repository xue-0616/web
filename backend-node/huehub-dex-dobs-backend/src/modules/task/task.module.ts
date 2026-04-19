import { Module } from '@nestjs/common';
import { MarketModule } from '../market/market.module';
import { CollectionModule } from '../collection/collection.module';
import { CommonModule } from '../../common/common.module';
import { BtcModule } from '../btc/btc.module';
import { TaskService } from './task.service';

@Module({
        imports: [MarketModule, CollectionModule, CommonModule, BtcModule],
        providers: [TaskService],
    })
export class TaskModule {
}
