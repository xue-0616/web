import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BlinkModule } from '../blink/blink.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TgUserEntity } from '../../database/entities/tg-user.entity';
import { UserFollowsEntity } from '../../database/entities/user-follows.entity';
import { BotGroupsEntity } from '../../database/entities/bot-group.entity';
import { BotReplyBlinkEntity } from '../../database/entities/bot-reply-blink.entity';
import { OpenAppActionEntity } from '../../database/entities/open-app-action.entity';
import { BotStatisticsService } from './bot-statistics.service';
import { TgUserDBService } from './db/tg-user-db.service';
import { UserFollowDBService } from './db/user-follow-db.service';
import { BotGroupsDBService } from './db/bot-group-db.service';
import { BotReplyBlinkDBService } from './db/bot-reply-blink-db.service';
import { OpenAppActionDBService } from './db/open-app-action-db.service';

@Module({
        imports: [
            CommonModule,
            BlinkModule,
            TypeOrmModule.forFeature([
                TgUserEntity,
                UserFollowsEntity,
                BotGroupsEntity,
                BotReplyBlinkEntity,
                OpenAppActionEntity,
            ]),
        ],
        providers: [
            BotStatisticsService,
            TgUserDBService,
            UserFollowDBService,
            TgUserDBService,
            BotGroupsDBService,
            BotReplyBlinkDBService,
            OpenAppActionDBService,
        ],
        exports: [BotStatisticsService],
    })
export class BotStatisticsModule {
}
