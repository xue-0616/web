import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AppLoggerService } from './logger.service';
import { sleep } from '../utils/tools';

@Injectable()
export class MyHttpService {
    constructor(private readonly logger: AppLoggerService, private readonly httpService: HttpService) {
        this.logger.setContext(MyHttpService.name);
    }
    async httpGet(url: string, config: any = {}, sendTimes: number = 1): Promise<any> {
            this.logger.log(`[httpGet] ${url}`);
            try {
                const result = await this.httpService.get(url, config).toPromise();
                return result?.data;
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
    async httpPost(url: string, params: any = {}, config: any = {}, sendTimes: number = 1): Promise<any> {
            this.logger.log(`[httpPost] ${url}`);
            try {
                const result = await this.httpService
                    .post(url, params, config)
                    .toPromise();
                return result?.data;
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
    async isNeedResend(errorMessage: string, sendTimes: number): Promise<boolean> {
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
