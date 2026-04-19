import { BadRequestException, Injectable } from '@nestjs/common';
import jwt_simple from 'jwt-simple';
import moment from 'moment';
import { StatusName, TIME, generateOtpCode } from '../../../shared/utils';
import { randomBytes } from 'crypto';

@Injectable()
export class OtpCodeBaseService {
    constructor(logger: any, redisService: any, apiConfigService: any, unipassConfigService: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.apiConfigService = apiConfigService;
        this.unipassConfigService = unipassConfigService;
        this.logger.setContext(OtpCodeBaseService.name);
    }
    logger: any;
    redisService: any;
    apiConfigService: any;
    unipassConfigService: any;
    async getSendCode(ctx: any, action: any, key: any, code: any) {
            const cacheKey = `otc_${action}_${key}`;
            await this.checkNotifyUserInterval(ctx, cacheKey);
            if (!code) {
                code = generateOtpCode(6);
            }
            await this.saveOtpCode(cacheKey, code);
            this.logger.log(`[sendEmailCode] OtpTokenService: start send otp cacheKey to ${cacheKey} with code ${code}`, ctx);
            return code;
        }
    async checkNotifyUserInterval(ctx: any, cacheKey: any) {
            const cachedOtpCode = await this.getOtpCode(cacheKey);
            if (!cachedOtpCode) {
                return;
            }
            const { time } = cachedOtpCode;
            const exp = moment().diff(moment(time), 'm');
            if (exp >= 30) {
                await this.removeCacheKey(cacheKey);
                return;
            }
            if (exp < 1) {
                this.logger.warn(`[checkNotifyUserInterval] OtpTokenService:  now - time < ${exp} m`);
                throw new BadRequestException(StatusName.OPERATION_FREQUENT);
            }
        }
    async getOtpCode(key: any) {
            const data = await this.redisService.getCacheData(key);
            if (!data) {
                return undefined;
            }
            return JSON.parse(data);
        }
    async saveOtpCode(key: any, code: any, ttl: any = TIME.HALF_HOUR) {
            const time = moment().valueOf();
            const cacheValue = JSON.stringify({ code, time });
            await this.redisService.saveCacheData(key, cacheValue, ttl);
        }
    async saveSendCodeTimes(ctx: any, cacheKey: any) {
            const today = moment().format('YYYY_MM_DD');
            let data = await this.getSendCodeTimes(cacheKey);
            const temp = {
                count: 1,
                time: today,
            };
            if ((data === null || data === void 0 ? void 0 : data.time) === temp.time) {
                data.count = data.count + 1;
            }
            else {
                data = temp;
            }
            const cacheValue = JSON.stringify(data);
            await this.redisService.saveCacheData(cacheKey, cacheValue, 24 * 60 * 60);
            this.logger.log(`[saveEmailSendCodeTimes] OtpTokenService: save email send times key = ${cacheKey}, cacheValue ${cacheValue}`, ctx);
        }
    async getSendCodeTimes(cacheKey: any) {
            const data = await this.redisService.getCacheData(cacheKey);
            if (!data) {
                return undefined;
            }
            const time = JSON.parse(data);
            if (time.count > this.apiConfigService.getOtpConfig.maxTime) {
                throw new BadRequestException(StatusName.MAX_SEND_TIMES);
            }
            return JSON.parse(data);
        }
    async getVerifyCodeData(ctx: any, cacheKey: any) {
            const data = await this.redisService.getCacheData(cacheKey);
            this.logger.log(`[getVerifyCodeData] OtpTokenService: verify email code times key = ${cacheKey}, data = ${data}`, ctx);
            if (!data) {
                return undefined;
            }
            const time = JSON.parse(data);
            time.count = time.count ? time.count + 1 : 1;
            const exp = moment().diff(moment(time.time), 'm');
            if (exp >= 30) {
                await this.removeCacheKey(cacheKey);
                return undefined;
            }
            if (time.count > this.apiConfigService.getOtpConfig.maxVerifyTime) {
                throw new BadRequestException(StatusName.MAX_VERIFY_TIMES);
            }
            return time;
        }
    async updateVerifyCodeData(ctx: any, action: any, key: any) {
            const cacheKey = `otc_${action}_${key}`;
            this.logger.log(`[updateVerifyCodeData] cacheKey ${cacheKey}`);
            await this.checkRequestsCount(ctx, cacheKey);
            const data = (await this.getVerifyCodeData(ctx, cacheKey));
            if (!data) {
                throw new BadRequestException(StatusName.OTP_CODE_NOT_FIND);
            }
            const cacheValue = JSON.stringify(data);
            await this.redisService.saveCacheData(cacheKey, cacheValue, TIME.HALF_HOUR);
            this.logger.log(`[saveEmailSendCodeTimes] OtpTokenService: save email send times key = ${cacheKey}, cacheValue ${cacheValue}`, ctx);
            return data;
        }
    async validateOtpCode(ctx: any, action: any, key: any, code: any) {
            const codeData = await this.updateVerifyCodeData(ctx, action, key);
            if ((codeData === null || codeData === void 0 ? void 0 : codeData.code) !== code) {
                throw new BadRequestException(StatusName.OTP_CODE_ERROR);
            }
            await this.removeCacheKey(`otc_${action}_${key}`);
        }
    async checkRequestsCount(ctx: any, cacheKey: any) {
            const times = moment().format('HHmm');
            cacheKey = `${cacheKey}_${times}`;
            const requestsCount = await this.redisService.getCacheData(cacheKey);
            const time = requestsCount ? Number(requestsCount) + 1 : 1;
            await this.redisService.saveCacheData(cacheKey, time, 2 * 60);
            this.logger.log(`[checkRequestsCount] OtpBaseService: ask times = ${time}, key is ${cacheKey} `, ctx);
            if (time > 10) {
                throw new BadRequestException(StatusName.OPERATION_FREQUENT);
            }
            return true;
        }
    async generateUpAuthToken(email: any, action: any, ctx: any, key: any = 'defaultkey') {
            const cacheKey = `ott_${action}_${email}_${key}`;
            const payload = { action, key: `${email}_${key}` };
            const jwtKey = randomBytes(16).toString('hex');
            const jwtToken = jwt_simple.encode(payload, jwtKey);
            const jwtKeyInfo = { jwtKey, jwtToken };
            const data = JSON.stringify(jwtKeyInfo);
            await this.redisService.saveCacheData(cacheKey, data, TIME.HALF_HOUR);
            this.logger.log(`[generateUpAuthToken] OtpBaseService: create a jwtKeyInfo:${data} `, ctx);
            return jwtKeyInfo.jwtToken;
        }
    async removeCacheKey(cacheKey: any) {
            await this.redisService.deleteCacheData(cacheKey);
        }
    async getUpAuthToken(action: any, email: any, key: any = 'defaultkey') {
            const cacheKey = `ott_${action}_${email}_${key}`;
            const jwtKeyInfo = await this.redisService.getCacheData(cacheKey);
            if (!jwtKeyInfo) {
                this.logger.log(`[cacheKey] key data not find ${cacheKey}`);
                return '';
            }
            return JSON.parse(jwtKeyInfo).jwtToken;
        }
    async verifyUpAuthToken(upAuthToken: any, action: any, email: any, del: any, key: any = 'defaultkey') {
            const isWhiteList = this.unipassConfigService.isTestWhiteList(email);
            this.logger.log(`[verifyUpAuthToken] OtpBaseService: isWhiteList = ${isWhiteList} `);
            if (isWhiteList) {
                return isWhiteList;
            }
            key = `${email}_${key}`;
            const cacheKey = `ott_${action}_${key}`;
            const data = await this.redisService.getCacheData(cacheKey);
            this.logger.log(`[verifyUpAuthToken] OtpBaseService: key = ${cacheKey} data = ${data} `);
            if (!data) {
                throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            const { jwtKey, jwtToken } = JSON.parse(data);
            if (jwtToken !== upAuthToken) {
                throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            const { action: oldAction, key: oldKey } = jwt_simple.decode(jwtToken, jwtKey);
            const isVerified = action === oldAction && key === oldKey;
            this.logger.log(`[verifyUpAuthToken] OtpBaseService:  : key = ${cacheKey} key = ${key}, oldKey = ${oldKey} isVerified = ${isVerified} del = ${del}`);
            if (!isVerified) {
                throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            if (del) {
                await this.redisService.deleteCacheData(cacheKey);
            }
            return isVerified;
        }
}
