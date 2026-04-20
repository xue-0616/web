import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import TelegramBot = require('node-telegram-bot-api');
import { ParseBlinkService } from '../blink/parse.blink.service';
import Redis from 'ioredis';
import { BlinkShortCodeDBService } from '../blink/blink-short-code-db.service';
import { IBlinkActionInfo } from '../../common/interface/blink-actions';
import { BotStatisticsService } from '../bot-statistics/bot-statistics.service';
import { BlinkShortCodeEntity } from '../../database/entities/blink-short-code.entity';
import { TIME } from '../../common/utils/time';
import { encodeBase58 } from '../../common/utils/tools';
import { JoinInStatus } from '../../database/entities/bot-group.entity';

@Injectable()
export class BotMessageService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly parseBlinkService: ParseBlinkService, private readonly blinkShortCodeDBService: BlinkShortCodeDBService, private readonly botStatisticsService: BotStatisticsService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(BotMessageService.name);
    }
    messageCacheKey(key: any) {
            return `${this.appConfig.nodeEnv}:Solagram:Bot:Message:$${key}{tag}`;
        }
    async parseBotMessage(msg: TelegramBot.Message, bot: TelegramBot): Promise<void> {
            const chatId = msg.chat.id;
            let messageId = msg.message_id;
            let key = this.messageCacheKey(`${chatId}_${messageId}`);
            let cacheMessageData = await this.redis.get(key);
            if (cacheMessageData) {
                this.logger.log(`[cacheMessageData]${key} already exists`);
                return;
            }
            this.logger.log(`[parsePrivateMessage] message key ${key}`);
            await this.redis.set(key, 'ok', 'EX', TIME.ONE_MINUTES);
            let blinkActions = await this.parseBlinkService.parseBlinkUrls(msg.text ?? '');
            if (!blinkActions || blinkActions.length === 0) {
                return;
            }
            if (!msg.from) {
                return;
            }
            const from = msg.from;
            this.logger.log(`parsePrivateMessage blinkUrls from ${JSON.stringify(from)}`);
            blinkActions.map(async (blink) => {
                await this.botSendMessage(msg.chat, messageId, blink, bot, from);
            });
        }
    async getBlinkUrlShortCode(blink: IBlinkActionInfo): Promise<BlinkShortCodeEntity | null> {
            try {
                let dbInfo = await this.blinkShortCodeDBService.findOrInsert(blink.url, blink.domain);
                return dbInfo;
            }
            catch (error) {
                this.logger.error(`[getBlinkUrlShortCode] ${(error as Error)?.stack}`);
            }
            return null;
        }
    async botSendMessage(chat: TelegramBot.Chat, messageId: number, blink: IBlinkActionInfo, bot: TelegramBot, from: TelegramBot.User): Promise<void> {
            let dbInfo = await this.getBlinkUrlShortCode(blink);
            if (!dbInfo) {
                this.logger.warn(`[botSendMessage] dbInfo is null`);
                return;
            }
            const privateChatUrl = `https://t.me/${this.appConfig.tgBotInfo.username}/${this.appConfig.tgBotInfo.appName}?startapp=${encodeBase58(JSON.stringify({
                short_code: dbInfo.shortCode,
                chat_id: `${chat.id}_${messageId}`,
            }))}`;
            const message = `*Solagram* has successfully transformed this BLink into a [Mini App](${privateChatUrl})!`;
            try {
                await bot.sendMessage(chat.id, message, {
                    parse_mode: 'Markdown',
                    reply_to_message_id: messageId,
                });
                await this.botStatisticsService.updateBotReplyBlink(messageId, chat.id, dbInfo.id, from, bot);
            }
            catch (error) {
                const e = error as Error;
                if (e.message ===
                    'ETELEGRAM: 403 Forbidden: bot was kicked from the group chat') {
                    this.logger.log(`[botSendMessage]  bot was kicked from the group chat ${JSON.stringify(chat)}`);
                    await this.botStatisticsService.updateGroupJoinStatus(chat, JoinInStatus.Leave, null as any, bot);
                }
                else {
                    this.logger.error(`[botSendMessage] ${e?.stack}`);
                }
            }
        }
    async botSendStartGuideMessageByApi(msg: TelegramBot.Message, bot: TelegramBot): Promise<void> {
            const chatId = msg.chat.id;
            let message = `How to use:\n- Send a Blink directly to me, and I'll transform it into a Mini App right away!\n- Invite me to a group, and I'll detect and transform any valid Blinks to Mini App in the group chat\nDon't have a Blink right now? You can just copy the demo Blink in the next message and send it to me:`;
            await bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
            });
            await bot.sendMessage(chatId, 'https://jup.ag/swap/USDT-SOL', {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
            });
        }
}
