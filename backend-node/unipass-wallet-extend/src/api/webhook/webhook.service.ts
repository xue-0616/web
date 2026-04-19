import { Injectable } from '@nestjs/common';
import { ApiConfigService } from 'src/common/api-config.service';
import { UpHttpService } from 'src/common/up.http.service';
import { FatPayWebhookBodyInput } from '../dto/webhook.fatpay.input';
import { FatPayHeaderInfo } from '../utils/sign.api.utils';
import { getLogger } from '../../common/logger/logger.helper';
import { sortRequestParameters, verifyFatPaySignature } from '../utils/pat-pay.utils';

@Injectable()
export class WebhookService {
    constructor(private readonly upHttp: UpHttpService, private readonly config: ApiConfigService) {
        this.logger = getLogger('webhook');
    }
    private logger: any;
    getFatPayOrderWebhook(headers: FatPayHeaderInfo, body: FatPayWebhookBodyInput): boolean | undefined {
            if (!headers['x-fp-nonce'] &&
                !headers['x-fp-partner-id'] &&
                !headers['x-fp-timestamp'] &&
                !headers[`x-fp-version`] &&
                !headers[`x-fp-signature`]) {
                return;
            }
            const fatPayHeaders = {
                'x-fp-nonce': headers['x-fp-nonce'],
                'x-fp-partner-id': headers['x-fp-partner-id'],
                'x-fp-timestamp': headers['x-fp-timestamp'],
                'x-fp-version': headers['x-fp-version'],
            };
            this.logger.info(JSON.stringify({ fatPayHeaders, body }));
            const signData = Object.assign({}, fatPayHeaders);
            const requestParameters = sortRequestParameters(signData, false);
            const method = `POST${this.config.getWebhookConfig.appHost}/webhook/fat-pay?`;
            this.logger.info({ requestParameters, method });
            const privateKey = this.config.getWebhookConfig.fatPayPublicKey;
            const isVerify = verifyFatPaySignature(method, requestParameters, privateKey, headers[`x-fp-signature`], this.logger);
            this.logger.info({ isVerify });
            if (!isVerify) {
                return;
            }
            const webHookUrl = this.config.getWebhookConfig.slackWebHookUrl;
            const playload = {
                fields: [
                    {
                        title: `接受到一条fatPay订单回调信息`,
                        type: 'mrkdwn',
                        value: '```' + `${JSON.stringify(body)}` + '```',
                    },
                ],
            };
            this.upHttp.httpPost(webHookUrl, playload);
            return isVerify;
        }
}
