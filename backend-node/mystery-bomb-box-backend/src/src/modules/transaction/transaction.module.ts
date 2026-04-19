import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DbModule } from '../db/db.module';
import { TransactionService } from './transaction.service';
import { MysteryBoxController } from './mystery.controller';

@Module({
        imports: [CommonModule, DbModule],
        providers: [TransactionService],
        controllers: [MysteryBoxController],
    })
export class TransactionModule {
}
