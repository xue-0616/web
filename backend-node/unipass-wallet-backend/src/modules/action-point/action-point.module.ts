import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActionPointEntity, UserActionPointHistoryEntity, UserActionPointRelayerEntity, UserActionPointTransactionsEntity } from './entities';
import { AccountModule } from '../account/account.module';
import { BullModule } from '@nestjs/bull';
import { ACTION_POINT_TRANSACTION_QUEUE } from '../../shared/utils';
import { ActionPointService } from './action-point.service';
import { ActionPointIssueService } from './admin/action-point.admin.service';
import { ActionPointShowService } from './show/action-point.show.service';
import { ActionPointTransactionService } from './transaction/action-point.transaction.service';
import { ActionPointTransactionProcessor } from './processor/transaction.processor';
import { ActionPointTransactionsService } from './db/action-point-db-transaction.service';
import { ActionPointAdminController } from './admin/action-point.admin.controller';
import { ActionPointShowController } from './show/action-point.show.controller';
import { ActionPointTransactionController } from './transaction/action-point.transaction.controller';

@Module({
        imports: [
            TypeOrmModule.forFeature([
                UserActionPointHistoryEntity,
                UserActionPointEntity,
                UserActionPointRelayerEntity,
                UserActionPointTransactionsEntity,
            ]),
            AccountModule,
            BullModule.registerQueue({ name: ACTION_POINT_TRANSACTION_QUEUE }),
        ],
        providers: [
            ActionPointService,
            ActionPointIssueService,
            ActionPointShowService,
            ActionPointTransactionService,
            ActionPointTransactionProcessor,
            ActionPointTransactionsService,
        ],
        controllers: [
            ActionPointAdminController,
            ActionPointShowController,
            ActionPointTransactionController,
        ],
        exports: [ActionPointService],
    })
export class ActionPointModule {
}
