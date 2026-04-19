import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { TgUserDBService } from './db/tg-user-db.service';
import { UserFollowDBService } from './db/user-follow-db.service';
import TelegramBot, { User } from 'node-telegram-bot-api';
import { TgUserEntity } from '../../database/entities/tg-user.entity';
import { FollowStatus, FollowType } from '../../database/entities/user-follows.entity';
import { BotGroupsDBService } from './db/bot-group-db.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { JoinInStatus } from '../../database/entities/bot-group.entity';
import { BotReplyBlinkDBService } from './db/bot-reply-blink-db.service';
import { MiniAppActionInputDto } from '../tg-user/dto/mini-app-action.input.dto';
import { OpenAppActionDBService } from './db/open-app-action-db.service';
import { BlinkShortCodeDBService } from '../blink/blink-short-code-db.service';
import { TIME } from '../../common/utils/time';

@Injectable()
export class BotStatisticsService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly tgUserDBService: TgUserDBService, private readonly userFollowDBService: UserFollowDBService, private readonly botGroupsDBService: BotGroupsDBService, private readonly botReplyBlinkDBService: BotReplyBlinkDBService, private readonly openBlinkActionDBService: OpenAppActionDBService, private readonly blinkShortCodeDBService: BlinkShortCodeDBService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(BotStatisticsService.name);
    }
    getMeCacheKey() {
            const token = this.appConfig.tgBotInfo.walletBotToken;
            return `${this.appConfig.nodeEnv}:Solagram:Bot:Me:$${token}{tag}`;
        }
    async getBotUserInfo(bot: any) {
            let key = this.getMeCacheKey();
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            try {
                let botUser = await bot.getMe();
                await this.redis.set(key, JSON.stringify(botUser), 'EX', TIME.DAY);
                return botUser;
            }
            catch (error) {
                this.logger.error(`[getBotUserInfo] error ${(error as Error)?.stack}`);
            }
        }
    userCacheKey(id: any) {
            return `${this.appConfig.nodeEnv}:Solagram:User:$${id}{tag}`;
        }
    async updateBotUser(user: User | undefined): Promise<TgUserEntity | undefined> {
            if (!user) {
                return undefined;
            }
            let key = this.userCacheKey(user.id);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return undefined;
            }
            let tgUserEntity = await this.tgUserDBService.findOrInsert(user);
            if (tgUserEntity) {
                await this.redis.set(key, tgUserEntity.id, 'EX', TIME.DAY);
            }
            return tgUserEntity ?? undefined;
        }
    async botStatistics(message: TelegramBot.Message, bot: TelegramBot): Promise<void> {
            let { from, chat, left_chat_member } = message;
            try {
                const botUser = await this.getBotUserInfo(bot);
                await this.updateBotUser(from);
                if (!from) {
                    return;
                }
                switch (chat.type) {
                    case 'private':
                        await this.updateUserFollowsData(from.id, FollowType.Bot, FollowStatus.Following, botUser);
                        break;
                    case 'group':
                    case 'supergroup':
                    case 'channel':
                        let status = left_chat_member && left_chat_member.id === botUser.id
                            ? JoinInStatus.Leave
                            : JoinInStatus.Active;
                        await this.updateGroupJoinStatus(chat, status, botUser);
                        break;
                    default:
                        break;
                }
            }
            catch (error) {
                this.logger.error(`[botStatistics] error ${(error as Error)?.stack}`);
            }
        }
    getUserFollowCacheKey(userId: any, type: any) {
            return `${this.appConfig.nodeEnv}:Solagram:User:Follow:$${userId}_${type}{tag}`;
        }
    async updateUserFollowsData(userId: number, type: FollowType, status: FollowStatus, botUser?: TelegramBot.User, bot?: TelegramBot): Promise<void> {
            try {
                if (status === FollowStatus.Following) {
                    let key = this.getUserFollowCacheKey(userId, type);
                    let cacheData = await this.redis.get(key);
                    if (cacheData) {
                        return;
                    }
                    await this.redis.set(key, status, 'EX', TIME.DAY);
                }
                if (bot) {
                    botUser = await this.getBotUserInfo(bot);
                }
                await this.userFollowDBService.findOrInsert(userId, type, status, botUser as User);
            }
            catch (error) {
                this.logger.error(`[statisticsUserFollow] error ${(error as Error)?.stack}`);
            }
        }
    getGroupCacheKey(chatId: any) {
            return `${this.appConfig.nodeEnv}:Solagram:Bot:Group:$${chatId}{tag}`;
        }
    async updateGroupJoinStatus(chat: TelegramBot.Chat, status: JoinInStatus, botUser: TelegramBot.User, bot?: TelegramBot): Promise<void> {
            if (bot) {
                botUser = await this.getBotUserInfo(bot);
            }
            if (status === JoinInStatus.Active) {
                let key = this.getGroupCacheKey(chat.id);
                let cacheData = await this.redis.get(key);
                if (cacheData) {
                    return;
                }
                await this.redis.set(key, status, 'EX', TIME.DAY);
            }
            await this.botGroupsDBService.findOrInsert(chat.id, chat.title ?? '', status, botUser);
        }
    async updateBotReplyBlink(messageId: number, chatId: TelegramBot.ChatId, blinkId: number, from: User, bot: TelegramBot): Promise<void> {
            let botUser = await this.getBotUserInfo(bot);
            await this.botReplyBlinkDBService.findOrInsert(messageId, Number(chatId), blinkId, from, botUser);
        }
    getBlinkActioCacheKey(key: any) {
            return `${this.appConfig.nodeEnv}:Solagram:App:Action:$${key}{tag}`;
        }
    async updateBlinkAction(input: MiniAppActionInputDto): Promise<void> {
            const { chat_id, user_id, action, app_type, source, short_code } = input;
            let replyBlink = null;
            let blinkInfo = null;
            if (chat_id) {
                const [chatId, messageId] = chat_id.trim().split('_').map(Number);
                if (!chatId || !messageId) {
                    this.logger.warn('[updateBlinkAction] Invalid chat_id format');
                    return;
                }
                replyBlink = await this.botReplyBlinkDBService.findOne({
                    chatId,
                    messageId,
                });
                if (!replyBlink) {
                    this.logger.warn('[updateBlinkAction] replyBlink not find');
                    return;
                }
            }
            if (short_code) {
                blinkInfo = await this.blinkShortCodeDBService.findOne({
                    shortCode: short_code,
                });
                if (!blinkInfo) {
                    this.logger.warn('[updateBlinkAction] blinkInfo not find');
                    return;
                }
            }
            if ((!replyBlink && short_code) ||
                (replyBlink && blinkInfo && replyBlink.blinkId !== blinkInfo.id) ||
                (replyBlink && replyBlink.userId !== user_id)) {
                this.logger.warn(`[updateBlinkAction] Mismatch between replyBlink and blinkInfo`);
                return;
            }
            let key = this.getBlinkActioCacheKey(`${app_type}_${action}_${user_id}_${source}_${replyBlink?.id}`);
            if (await this.redis.get(key)) {
                return;
            }
            let entity = await this.openBlinkActionDBService.findOrInsert(user_id, action, app_type, source, replyBlink?.id ?? 0, blinkInfo?.id ?? 0);
            if (entity) {
                await this.redis.set(key, entity.id, 'EX', TIME.DAY);
            }
        }
}
