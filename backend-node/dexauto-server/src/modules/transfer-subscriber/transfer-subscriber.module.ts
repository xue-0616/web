import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TransferSyncerModule } from '../transfer-syncer/transfer-syncer.module';
import { TokenModule } from '../token/token.module';
import { MessageNotifierModule } from '../message-notifier/message-notifier.module';
import { AutomaticStrategySyncerModule } from '../automatic-strategy-syncer/automatic-strategy-syncer.module';
import { TransferSubscriberService } from './transfer-subscriber.service';

@Module({
    imports: [
        TransferSyncerModule,
        ConfigModule,
        TokenModule,
        MessageNotifierModule,
        AutomaticStrategySyncerModule,
    ],
    providers: [TransferSubscriberService],
    exports: [TransferSubscriberService],
})
export class TransferSubscriberModule {}
