import { Body, Controller, Post, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { FatPayWebhookBodyInput } from '../dto/webhook.fatpay.input';
import { RequestContext } from '../utils/sign.api.utils';
import { WebhookService } from './webhook.service';
import { getLogger } from '../../common/logger/logger.helper';

@ApiTags('webhook')
@Controller('webhook')
@SkipThrottle()
export class WebhookController {
    constructor(private readonly webhookService: WebhookService) {
        this.logger = getLogger('webhook');
    }
    private logger: any;
    @Post('fat-pay')
    getFatPayOrderWebhook(@Request() req: RequestContext, @Body() body: FatPayWebhookBodyInput): boolean {
            const data = this.webhookService.getFatPayOrderWebhook(req.headers as any, body);
            return data ?? false;
        }
}
