import { Injectable } from '@nestjs/common';
import moment from 'moment';
import querystringify from 'querystringify';
import { TIME } from '../../shared/utils';

@Injectable()
export class IpreCaptchaService {
    constructor(logger: any, redisService: any, upHttpService: any, apiConfigService: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.upHttpService = upHttpService;
        this.apiConfigService = apiConfigService;
        this.logger.setContext(IpreCaptchaService.name);
    }
    logger: any;
    redisService: any;
    upHttpService: any;
    apiConfigService: any;
    async isNeedShowReCaptcha(ip: any) {
            const data = await this.getCacheData(ip);
            if (!data) {
                return false;
            }
            const { count } = data;
            const isVerify = this.isNeedVerificationCaptcha(count, ip);
            this.logger.log(`[isNeedShowReCaptcha] IpreCaptchaService ip(${ip}) is show verify = ${isVerify}`);
            return isVerify;
        }
    isNeedVerificationCaptcha(count: any, ip: any) {
            const isCanRequest = count >= this.apiConfigService.getOtpConfig.showCaptcha;
            this.logger.log(`[isNeedVerificationCaptcha] IpreCaptchaService ip(${ip}), request count=${count},max=${this.apiConfigService.getOtpConfig.showCaptcha}`);
            return isCanRequest;
        }
    isCanRequest(count: any, ip: any) {
            const isCanRequest = count < this.apiConfigService.getOtpConfig.ipMaxRequest;
            this.logger.log(`[isCanRequest] IpreCaptchaService ip(${ip}), request count=${count},max=${this.apiConfigService.getOtpConfig.ipMaxRequest}`);
            return isCanRequest;
        }
    async verifyReCaptchaResponse(response: any, ip: any) {
            const secret = this.apiConfigService.getGoogelConfig.siteKey;
            const url = 'https://www.google.com/recaptcha/api/siteverify';
            const data = querystringify.stringify({
                secret,
                response,
            });
            const config = {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            };
            const res = (await this.upHttpService.httpPost(url, data, config));
            if (!res) {
                this.logger.log(`[verifyReCaptchaResponse] res = null, ip=${ip}, verify is ${false}`);
                return false;
            }
            const isSuccess = res.score < 0.5 ? false : res.success;
            this.logger.log(`[verifyReCaptchaResponse]  res=${JSON.stringify(res)} ip=${ip}, verify is ${isSuccess}`);
            return isSuccess;
        }
    async verifyCloudflareCaptchaResponse(response: any, ip: any) {
            const secret = this.apiConfigService.getThirdPartyApiConfig.cloudflareSecretKey;
            const body = {
                secret,
                response,
                remoteip: ip,
            };
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
            const res = (await this.upHttpService.httpPost(url, body, config));
            if (!res) {
                this.logger.log(`[verifyCloudflareCaptchaResponse] res = null, ip=${ip}, verify is ${false}`);
                return false;
            }
            this.logger.log(`[verifyCloudflareCaptchaResponse]  res=${JSON.stringify(res)} ip=${ip}, verify is ${res.success}`);
            return res.success;
        }
    async saveReCaptchaCache(ip: any) {
            const key = `${ip}:reCaptcha`;
            const data = await this.getCacheData(ip);
            const cache = {
                count: 1,
                time: moment().format('YYYY-MM-DD'),
            };
            if (data) {
                const { count, time } = data;
                cache.count = count + 1;
                cache.time = time;
            }
            await this.redisService.saveCacheData(key, JSON.stringify(cache), TIME.DAY);
            this.logger.log(`[isNeedShowreCaptcha] IpreCaptchaService ip(${ip}) save cache data = ${JSON.stringify(cache)}`);
        }
    async getCacheData(ip: any) {
            const key = `${ip}:reCaptcha`;
            const cacheData = await this.redisService.getCacheData(key);
            if (cacheData) {
                const data = JSON.parse(cacheData);
                this.logger.log(`[getCacheData] IpreCaptchaService ip(${ip}) cacheData = ${cacheData}`);
                const { time } = data;
                const exp = moment().diff(moment(time), 'd');
                if (exp < 1) {
                    return data;
                }
                await this.redisService.deleteCacheData(key);
            }
        }
    async isVerifyReCaptcha(ip: any, response: any) {
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
                isVerify = false;
                return isVerify;
            }
            if (this.isNeedVerificationCaptcha(count, ip) && !response) {
                isVerify = false;
            }
            return isVerify;
        }
}
