import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Notify } from './entities/notify.entity';
import { User } from '../user/entities/user.entity';
import { MessageNotifierService } from './message-notifier.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notify, User]),
        ConfigModule,
    ],
    providers: [MessageNotifierService],
    exports: [MessageNotifierService],
})
export class MessageNotifierModule {}
