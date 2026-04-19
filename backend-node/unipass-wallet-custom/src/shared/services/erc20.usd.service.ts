import { Injectable } from '@nestjs/common';
import { TIME } from '../utils';

@Injectable()
export class ERC20ToUSDService {
    constructor(logger: any, upHttpService: any, redisService: any, apiConfigService: any) {
        this.logger = logger;
        this.upHttpService = upHttpService;
        this.redisService = redisService;
        this.apiConfigService = apiConfigService;
        this.logger.setContext(ERC20ToUSDService.name);
    }
    logger: any;
    upHttpService: any;
    redisService: any;
    apiConfigService: any;
    async getTokenUsdByID(ids: any) {
            const tokenData: Record<string, unknown> = {};
            const queryIds: any[] = [];
            for (const item of ids) {
                const idKey = `token_${item}`;
                const price = await this.redisService.getCacheData(idKey);
                if (price) {
                    tokenData[item] = price;
                }
                else {
                    queryIds.push(item);
                }
            }
            if (queryIds.length === 0) {
                return tokenData;
            }
            const idList = queryIds.join(',');
            const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${idList}`;
            const config = {
                headers: {
                    'X-CMC_PRO_API_KEY': this.apiConfigService.getThirdPartyApiConfig.cmcApiKey,
                },
            };
            const reqData = await this.upHttpService.httpGet(url, config);
            if (!reqData) {
                return {};
            }
            const data = reqData.data;
            for (const item in data) {
                const idKey = `token_${item}`;
                let price = data[item].quote.USD.price;
                if (price >= 0) {
                    await this.redisService.saveCacheData(idKey, price, TIME.ONE_HOUR);
                    tokenData[item] = price;
                }
            }
            return tokenData;
        }
}
