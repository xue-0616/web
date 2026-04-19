import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import StatisticsEvent from '../../entities/default/statistics/statistics-event.entity';
import StatisticsSign from '../../entities/default/statistics/statistics-sign.entity';
import { AccountsEntity } from '../../entities/unipass/accounts.entity';
import { LoginRecordsEntity } from '../../entities/unipass/login.records.entity';
import { OriHashEntity } from '../../entities/unipass/ori.hash.entity';
import { RelayerTransactionEntity } from '../../entities/relayer/relaye.transactions.entity';
import { SharedModule } from '../../shared/shared.module';
import { UnipassController } from './unipass.controller';
import { ActionPointController } from './ap/action-point.issue.controller';
import { ActionPointIssueService } from './ap/action-point.issue.service';
import { QueryAbiService } from './chain/query-abi.service';
import { TransactionService } from './chain/transaction.service';
import { ElasticService } from './elastic.service';
import { AccountEventService } from './monitor/account.evnets';
import { DkimService } from './monitor/dkim.service';
import { MonitorController } from './monitor/monitor.controller';
import { OpenIdService } from './monitor/open.id.service';
import { OrderService } from './order/order.service';
import { SnapAppStatisticsController } from './payment_snap/statistics.controller';
import { BaseStatisticsService } from './payment_snap/server/base-statistics.server';
import { PaymentSnapGasStatisticsService } from './payment_snap/server/payment-snap-gas.server';
import { PaymentTxStatisticsService } from './payment_snap/server/payment-tx.server';
import { RegisterStatisticsService } from './payment_snap/server/register-statistics.servier';
import { SnapAppDbService } from './payment_snap/server/snap-app-db.service';
import { GasStatisticsService } from './relayer/gas.statistics.service';
import { RelayerService } from './relayer/relayer.service';
import { StatisticsService } from './statistics.service';
import { UnipassService } from './unipass.service';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([AccountsEntity, OriHashEntity, LoginRecordsEntity], 'UniPass_db'),
    TypeOrmModule.forFeature([RelayerTransactionEntity], 'Relayer_db'),
    TypeOrmModule.forFeature([StatisticsEvent, StatisticsSign], 'default'),
  ],
  controllers: [UnipassController, MonitorController, SnapAppStatisticsController, ActionPointController],
  providers: [
    UnipassService,
    StatisticsService,
    QueryAbiService,
    TransactionService,
    AccountEventService,
    GasStatisticsService,
    RelayerService,
    ElasticService,
    OpenIdService,
    DkimService,
    OrderService,
    SnapAppDbService,
    BaseStatisticsService,
    RegisterStatisticsService,
    PaymentSnapGasStatisticsService,
    PaymentTxStatisticsService,
    ActionPointIssueService,
  ],
  exports: [UnipassService, StatisticsService, QueryAbiService, TransactionService],
})
export class UnipassModule {}
