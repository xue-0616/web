import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BlinkModule } from '../blink/blink.module';
import { BotStatisticsModule } from '../bot-statistics/bot-statistics.module';
import { TgBotService } from './tg-bot.service';
import { BotMessageService } from './message.service';
import { WebhookController } from './webhook.controller';

@Module({
        imports: [CommonModule, BlinkModule, BotStatisticsModule],
        providers: [TgBotService, BotMessageService],
        controllers: [WebhookController],
    })
export class TgBotModule {
}
