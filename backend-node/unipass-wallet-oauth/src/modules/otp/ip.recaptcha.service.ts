// Recovered from dist/ip.recaptcha.service.js.map (source: ../../../src/modules/otp/ip.recaptcha.service.ts)
import { Injectable } from '@nestjs/common';
import * as querystringify from 'querystringify';
import { ApiConfigService, AppLoggerService, RedisService, UpHttpService } from '../../shared/services';
import { TIME } from '../../shared/utils';

@Injectable()
export class IpreCaptchaService {
    constructor(
        private readonly logger: AppLoggerService,
        private readonly redisService: RedisService,
        private readonly upHttpService: UpHttpService,
        private readonly apiConfigService: ApiConfigService,
    ) {}

    isNeedVerificationCaptcha(count: number, ip: string): boolean {
        const max = (this.apiConfigService.getOtpConfig as any).showCaptcha;
        const isCanRequest = count >= max;
        this.logger.log(`[isNeedVerificationCaptcha] ip(${ip}), request count=${count},max=${max}`);
        return isCanRequest;
    }

    isCanRequest(count: number, ip: string): boolean {
        const max = (this.apiConfigService.getOtpConfig as any).maxVerifyTime;
        const isCanRequest = count < max;
        this.logger.log(`[isCanRequest] ip(${ip}), request count=${count},max=${max}`);
        return isCanRequest;
    }

    async verifyReCaptchaResponse(response: string, ip: string): Promise<boolean> {
        const secret = (this.apiConfigService.getGoogelConfig as any).siteKey;
        const url = 'https://www.google.com/recaptcha/api/siteverify';
        const data = querystringify.stringify({ secret, response });
        const config = {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };
        const res = await this.upHttpService.httpPost(url, data, config);
        if (!res) {
            this.logger.log(`[verifyReCaptchaResponse] res = null, ip=${ip}, verify is false`);
            return false;
        }
        const isSuccess = res.score < 0.5 ? false : res.success;
        this.logger.log(`[verifyReCaptchaResponse] res=${JSON.stringify(res)} ip=${ip}, verify is ${isSuccess}`);
        return isSuccess;
    }

    async saveReCaptchaCache(ip: string): Promise<void> {
        const key = `${ip}:reCaptcha`;
        const data = await this.getCacheData(ip);
        const cache = {
            count: data?.count ? data.count + 1 : 1,
            time: data?.time ?? new Date().toISOString().slice(0, 10),
        };
        await this.redisService.saveCacheData(key, JSON.stringify(cache), TIME.DAY);
        this.logger.log(`[isNeedShowreCaptcha] ip(${ip}) save cache data = ${JSON.stringify(cache)}`);
    }

    async getCacheData(ip: string): Promise<{ count: number; time: string } | undefined> {
        const key = `${ip}:reCaptcha`;
        const cacheData = await this.redisService.getCacheData(key);
        if (cacheData) {
            const data = JSON.parse(cacheData);
            this.logger.log(`[getCacheData] ip(${ip}) cacheData = ${cacheData}`);
            return data;
        }
        return undefined;
    }

    async isVerifyReCaptcha(ip: string, response?: string): Promise<boolean> {
        let isVerify = true;
        if (response) {
            isVerify = await this.verifyReCaptchaResponse(response, ip);
            if (!isVerify) {
                return isVerify;
            }
        }
        const data = await this.getCacheData(ip);
        if (!data) {
            return isVerify;
        }
        const { count } = data;
        if (!this.isCanRequest(count, ip)) {
            return false;
        }
        if (this.isNeedVerificationCaptcha(count, ip) && !response) {
            return false;
        }
        return isVerify;
    }
}
