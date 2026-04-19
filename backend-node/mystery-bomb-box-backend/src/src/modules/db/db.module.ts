import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrabMysteryBoxEntity } from '../../database/entities/grab-mystery-boxs.entity';
import { MysteryBoxEntity } from '../../database/entities/mystery-boxs.entity';
import { TransactionEntity } from '../../database/entities/transaction.entity';
import { MysteryBoxDbService } from './mystery-boxs.service';
import { GrabMysteryBoxDbService } from './grab-mystery-boxs.service';
import { DbService } from './db.service';
import { TransactionDbService } from './transaction-db.service';

@Module({
        imports: [
            CommonModule,
            TypeOrmModule.forFeature([
                GrabMysteryBoxEntity,
                MysteryBoxEntity,
                TransactionEntity,
            ]),
        ],
        providers: [
            MysteryBoxDbService,
            GrabMysteryBoxDbService,
            DbService,
            TransactionDbService,
        ],
        exports: [
            MysteryBoxDbService,
            GrabMysteryBoxDbService,
            DbService,
            TransactionDbService,
        ],
    })
export class DbModule {
}
