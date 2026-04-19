import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Wallet } from '../wallet/entities/wallet.entity';
import { TradingOrder } from '../trading/entities/tradingOrder.entity';
import { TransferSyncerService } from './transfer-syncer.service';
import { TokenModule } from '../token/token.module';
import { MessageNotifierModule } from '../message-notifier/message-notifier.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Wallet, TradingOrder]),
        ConfigModule,
        TokenModule,
        MessageNotifierModule,
    ],
    providers: [TransferSyncerService],
    exports: [TransferSyncerService],
})
export class TransferSyncerModule {}
