import { Injectable } from '@nestjs/common';
import { sleep } from '../utils';

@Injectable()
export class UpHttpService {
    constructor(logger: any, httpService: any) {
        this.logger = logger;
        this.httpService = httpService;
        this.logger.setContext(UpHttpService.name);
    }
    logger: any;
    httpService: any;
    async httpGet(url: any, config: any = {}, sendTimes: any = 1): Promise<any> {
            this.logger.log(`[httpGet] ${url}`);
            try {
                const result = await this.httpService.get(url, config).toPromise();
                return result === null || result === void 0 ? void 0 : result.data;
            }
            catch (error) {
                const e = error as Error;
                const isNeedResend = await this.isNeedResend(e.message, sendTimes);
                if (isNeedResend) {
                    return await this.httpGet(url, config, ++sendTimes);
                }
                this.logger.error(`[httpGet] ${e},data=${JSON.stringify({
                    url,
                    config,
                })}`);
            }
        }
    async httpPost(url: any, params: any = {}, config: any = {}, sendTimes: any = 1): Promise<any> {
            this.logger.log(`[httpPost] ${url}`);
            try {
                const result = await this.httpService
                    .post(url, params, config)
                    .toPromise();
                return result === null || result === void 0 ? void 0 : result.data;
            }
            catch (error) {
                const e = error as Error;
                const isNeedResend = await this.isNeedResend(e.message, sendTimes);
                if (isNeedResend) {
                    return await this.httpPost(url, params, config, ++sendTimes);
                }
                this.logger.error(`[httpPost] error ${e}, data=${JSON.stringify({
                    url,
                    params,
                    config,
                })}`);
            }
        }
    async isNeedResend(errorMessage: any, sendTimes: any) {
            if (sendTimes > 2) {
                return false;
            }
            if (errorMessage === 'Request failed with status code 429') {
                this.logger.log(`${errorMessage} sleep(500) ms sendTimes = ${sendTimes}`);
                await sleep(500);
                return true;
            }
            return false;
        }
}
