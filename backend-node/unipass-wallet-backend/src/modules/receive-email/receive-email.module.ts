import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { BullModule } from '@nestjs/bull';
import { ZK_QUEUE } from '../../shared/utils';
import { ReceiveEmailController } from './receive-email.controller';
import { ReceiveEmailService } from './receive-email.service';
import { ZkService } from './zk.service';
import { ZKProcessor } from './processor/zk.processor';

@Module({
        imports: [AccountModule, BullModule.registerQueue({ name: ZK_QUEUE })],
        controllers: [ReceiveEmailController],
        providers: [ReceiveEmailService, ZkService, ZKProcessor],
    })
export class ReceiveEmailModule {
}
