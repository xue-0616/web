import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { BotMessageService } from './message.service';
// The decompiled `import TelegramBot from 'node-telegram-bot-api'`
// produces `require(...).default` which is undefined (the module is a
// bare class export). Rewrite as TS import-equals so TelegramBot is
// both a value and a type.
import TelegramBot = require('node-telegram-bot-api');
import type { Update } from 'node-telegram-bot-api';
import { BotStatisticsService } from '../bot-statistics/bot-statistics.service';

@Injectable()
export class TgBotService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly botMessageService: BotMessageService, private readonly botStatisticsService: BotStatisticsService) {
        this.processingMessages = new Set();
        this.logger.setContext(TgBotService.name);
        this.initBot();
    }
    bot!: TelegramBot;
    getBotInstance(): TelegramBot {
        return this.bot;
    }
    private processingMessages: any;
    async initBot() {
            const token = this.appConfig.tgBotInfo.walletBotToken;
            if (!token) {
                // Rehearsal / CI mode: no Telegram token provided. Skip
                // bot construction entirely so the Nest app can still
                // boot. Webhook routes will be no-ops.
                this.logger.warn('[initBot] no walletBotToken configured — bot disabled');
                return;
            }
            this.bot = new TelegramBot(token, {
                webHook: true,
            });
            let webhookInfo = await this.bot.getWebHookInfo();
            const webhookUrl = `${this.appConfig.webhookConfig.hostname}/solagram/bot/wallet/webhook`;
            if (webhookInfo.url !== webhookUrl) {
                await this.bot.setWebHook(webhookUrl, {
                    secret_token: this.appConfig.webhookConfig.secretToken,
                    max_connections: this.appConfig.webhookConfig.maxConnections,
                });
            }
            this.logger.log(`[initBot] BOT is running ...`);
        }
    async parseBotMessage(update: Update): Promise<void> {
            let { message, update_id } = update;
            if (!message || this.processingMessages.has(update_id))
                return;
            this.processingMessages.add(update_id);
            this.botStatisticsService.botStatistics(message, this.bot);
            try {
                let { text } = message;
                if (text && text.startsWith('/')) {
                    await this.handleCommand(message);
                }
                else if (text) {
                    await this.handleMessage(message);
                }
            }
            catch (error) {
                this.logger.error(`[parseBotMessage] new start error ${(error as Error)?.stack}`);
            }
            finally {
                this.processingMessages.delete(update_id);
            }
        }
    async handleMessage(msg: any) {
            this.logger.log(`[handleMessage] ${JSON.stringify(msg)}`);
            await this.botMessageService.parseBotMessage(msg, this.bot);
        }
    async handleCommand(msg: any) {
            let { text } = msg;
            if (text.startsWith('/start')) {
                await this.botMessageService.botSendStartGuideMessageByApi(msg, this.bot);
            }
            else {
            }
        }
}
