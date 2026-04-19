import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TgBotModule } from '../tg-bot/tg-bot.module';
import { BotStatisticsModule } from '../bot-statistics/bot-statistics.module';
import { NotifyService } from './notify.service';
import { NotifyController } from './notify.controller';

@Module({
        imports: [CommonModule, TgBotModule, BotStatisticsModule],
        providers: [NotifyService],
        controllers: [NotifyController],
    })
export class NotifyModule {
}
