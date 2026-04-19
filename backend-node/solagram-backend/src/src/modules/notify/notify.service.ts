import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { TgBotService } from '../tg-bot/tg-bot.service';
import { BotNotifyInputDto } from './dto/bot-notify-input.dto';
import { TgSolAddressDBService } from '../bot-statistics/db/tg-sol-address.service';

@Injectable()
export class NotifyService {
    constructor(private readonly logger: AppLoggerService, private readonly tgBotService: TgBotService, private readonly tgSolAddressDBService: TgSolAddressDBService) {
        this.logger.setContext(NotifyService.name);
    }
    async notify(input: BotNotifyInputDto): Promise<void> {
            const { address, source } = input;
            let entities = await this.tgSolAddressDBService.find({ address });
            if (entities.length === 0) {
                this.logger.warn(`[notify] address not find tg user id ${address}`);
                return;
            }
            let bot = this.tgBotService.getBotInstance();
            try {
                await Promise.all(entities.map((entity) => {
                    let message = `${input.message}\n\n_Notification from ${source}_`;
                    bot.sendMessage(entity.userId, message, {
                        parse_mode: 'Markdown',
                    });
                }));
            }
            catch (error) {
                this.logger.error(`[notify] error ${error?.stack}`);
            }
        }
}
