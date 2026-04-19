import { BadRequestException, Injectable } from '@nestjs/common';
import { addDays, format, getUnixTime, subDays } from 'date-fns';
import { stringify } from 'querystring';
import { PaginatedResponseDto } from '../../../common/class/res.class';
import { FatPayOrderOutput } from '../../../modules/unipass/dto/fat-pay.order.output';
import { signatureFatPay, sortRequestParameters, verifyFatPaySignature } from '../../../modules/unipass/order/utils';
import { ApiConfigService } from '../../../shared/services/api-config.service';
import { UpHttpService } from '../../../shared/services/up.http.service';

@Injectable()
export class OrderService {
    constructor(private readonly upHttp: UpHttpService, private readonly config: ApiConfigService) {}

    async getFatPayOrderUrl(input: any): Promise<PaginatedResponseDto<FatPayOrderOutput>> {
        let { start, page, limit: size } = input;
        if (!start) {
            start = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        }
        const end = format(addDays(new Date(start), 7), 'yyyy-MM-dd');
        if (!page) {
            page = 1;
        }
        if (!size) {
            size = 20;
        }
        const partnerId = this.config.getOnOffRampConfig.fatPayPartnerId;
        const host = `https://api.ramp.fatpay.xyz/open/api/onramp/order`;
        const privateKey = this.config.getOnOffRampConfig.fatPayPrivateKey;
        const query = {
            startTime: getUnixTime(new Date(start)),
            endTime: getUnixTime(new Date(end)),
            page,
            size,
        };
        const publicHeader = {
            'X-Fp-Version': 'v1.0',
            'X-Fp-Timestamp': getUnixTime(new Date()),
            'X-Fp-Nonce': 68964,
            'X-Fp-Partner-Id': partnerId,
        };
        const publicHeaderLower = sortRequestParameters({
            'X-Fp-Version': 'v1.0',
            'X-Fp-Timestamp': getUnixTime(new Date()),
            'X-Fp-Nonce': 68964,
            'X-Fp-Partner-Id': partnerId,
        }, true);
        const signData = {
            ...publicHeaderLower,
            ...query,
        };
        const requestParameters = sortRequestParameters(signData, false);
        const method = `GETapi.ramp.fatpay.xyz/open/api/onramp/order?`;
        const signature = signatureFatPay(method, requestParameters, privateKey);
        const headers = {
            ...publicHeader,
            'X-Fp-Signature': signature,
            'Content-Type': 'application/json',
        };
        const url = `${host}?${stringify(query)}`;
        const order = (await this.upHttp.httpGet(url, {
            headers,
        }));
        let list: any[] = [];
        let pagination = {
            total: 0,
            size: 0,
            page: 0,
        };
        if (!order) {
            return {
                list,
                pagination,
            };
        }
        if (order.code !== 10000) {
            throw new BadRequestException(order.msg);
        }
        list = order.data.list;
        pagination = {
            total: order.data.totalCount,
            size: order.data.size,
            page: order.data.page,
        };
        return { list, pagination };
    }
    getFatPayOrderWebhook(headers: Record<string, any>, body: Record<string, any>): boolean {
        // Security: Validate all required signature headers are present (use || not &&)
        if (!headers['X-Fp-Nonce'] ||
            !headers['X-Fp-Partner-Id'] ||
            !headers['X-Fp-Timestamp'] ||
            !headers[`X-Fp-Version`] ||
            !headers[`X-Fp-Signature`]) {
            throw new BadRequestException('Missing required webhook signature headers');
        }
        const fatPayHeaders = {
            'X-Fp-Nonce': headers['X-Fp-Nonce'],
            'X-Fp-Partner-Id': headers['X-Fp-Partner-Id'],
            'X-Fp-Timestamp': headers['X-Fp-Timestamp'],
            'X-Fp-Version': headers['X-Fp-Version'],
        };
        const publicHeaderLower = sortRequestParameters(fatPayHeaders, true);
        const signData = {
            ...publicHeaderLower,
            ...body,
        };
        const requestParameters = sortRequestParameters(signData, false);
        const method = `POSTcms.wallet.unipass.vip/admin/unipass/order/fat-pay/webhook?`;
        const privateKey = this.config.getOnOffRampConfig.fatPayPrivateKey;
        const isVerify = verifyFatPaySignature(method, requestParameters, privateKey, headers[`X-Fp-Signature`]);
        // Security: Reject webhook if signature verification fails
        if (!isVerify) {
            throw new BadRequestException('Invalid webhook signature');
        }
        const webHookUrl = this.config.getOnOffRampConfig.slackWebHookUrl;
        const playload = {
            fields: [
                {
                    title: `接受到一条fatPay订单回调信息[${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}]`,
                    type: 'mrkdwn',
                    value: '```' + `${JSON.stringify(body)}` + '```',
                },
            ],
        };
        this.upHttp.httpPost(webHookUrl, playload);
        return isVerify;
    }
}
