import { Body, Controller, Headers, Post, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { Response } from 'express';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { Update } from 'node-telegram-bot-api';
import { TgBotService } from './tg-bot.service';

@Controller('bot')
@ApiTags('bot')
export class WebhookController {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly tgBotService: TgBotService) {
        this.logger.setContext(WebhookController.name);
    }
    @Post('wallet/webhook')
    async handleWebhook(@Headers('x-telegram-bot-api-secret-token') secretToken: string, @Body() update: Update, @Res() res: Response): Promise<void> {
            if (secretToken !== this.appConfig.webhookConfig.secretToken) {
                throw new UnauthorizedException('Invalid secret token');
            }
            await this.tgBotService.parseBotMessage(update);
            res.sendStatus(200);
        }
}
