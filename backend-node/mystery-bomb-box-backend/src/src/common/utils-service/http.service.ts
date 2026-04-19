import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AppLoggerService } from './logger.service';
import { lastValueFrom } from 'rxjs';
import { sleep } from '../utils/tools';

@Injectable()
export class MyHttpService {
    constructor(private readonly logger: AppLoggerService, private readonly httpService: HttpService) {
        this.logger.setContext(MyHttpService.name);
    }
    async httpGet(url: string, config: any = {}, sendTimes: number = 1): Promise<any> {
            try {
                const result = await lastValueFrom(this.httpService.get(url, config));
                return result?.data;
            }
            catch (error) {
                const e = error as any;
                const isNeedResend = await this.isNeedResend(e.message, sendTimes, e.name);
                if (isNeedResend) {
                    return await this.httpGet(url, config, ++sendTimes);
                }
                let response = null;
                try {
                    response = e.response.data;
                }
                catch (_inner) { }
                this.logger.error(`[httpPost] error ${e}, ${e.name} data=${JSON.stringify({
                    url,
                    config,
                    sendTimes,
                    response,
                })}`);
            }
        }
    async httpPost(url: string, params: any = {}, config: any = {}, sendTimes: number = 1): Promise<any> {
            try {
                const result = await lastValueFrom(this.httpService.post(url, params, config));
                return result?.data;
            }
            catch (error) {
                const e = error as any;
                const isNeedResend = await this.isNeedResend(e.message, sendTimes, e.name);
                if (isNeedResend) {
                    return await this.httpPost(url, params, config, ++sendTimes);
                }
                let response = null;
                try {
                    response = e.response.data;
                }
                catch (_inner) { }
                this.logger.error(`[httpPost] error ${e}, ${e.name} data=${JSON.stringify({
                    url,
                    params,
                    config,
                    sendTimes,
                    response,
                })}`);
            }
        }
    async isNeedResend(errorMessage: string, sendTimes: number, errorName: string): Promise<boolean> {
            if (sendTimes > 3) {
                return false;
            }
            const retryMessageList = [
                'Request failed with status code 429',
                'Client network socket disconnected before secure TLS connection was established',
                'socket hang up',
            ];
            const retryErrorNameList = ['AggregateError'];
            if (retryMessageList.includes(errorMessage) ||
                retryErrorNameList.includes(errorName)) {
                await sleep(50 * sendTimes);
                return true;
            }
            return false;
        }
}
