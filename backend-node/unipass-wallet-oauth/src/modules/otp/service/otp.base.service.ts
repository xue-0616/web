// Recovered from dist/otp.base.service.js.map (source: ../../../../src/modules/otp/service/otp.base.service.ts)
import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as jwtSimple from 'jwt-simple';
import { RequestContext } from '../../../interfaces';
import { ApiConfigService, AppLoggerService, RedisService } from '../../../shared/services';
import { StatusName, TIME, generateOtpCode } from '../../../shared/utils';

@Injectable()
export class OtpCodeBaseService {
    constructor(
        private readonly logger: AppLoggerService,
        private readonly redisService: RedisService,
        private readonly apiConfigService: ApiConfigService,
    ) {}

    async getSendCode(ctx: RequestContext, action: string, key: string, ttl = TIME.HALF_HOUR): Promise<string> {
        const code = generateOtpCode();
        const cacheKey = `otc_${action}_${key}`;
        const cacheValue = JSON.stringify({ code, count: 0, time: Date.now() });
        await this.redisService.saveCacheData(cacheKey, cacheValue, ttl);
        this.logger.log(`[getSendCode] key = ${cacheKey}`, ctx);
        return code;
    }

    async saveSendCodeTimes(ctx: RequestContext, cacheKey: string): Promise<void> {
        const data = (await this.getSendCodeTimes(cacheKey)) ?? { count: 0, time: new Date().toISOString().slice(0, 10) };
        data.count += 1;
        await this.redisService.saveCacheData(cacheKey, JSON.stringify(data), TIME.DAY);
        this.logger.log(`[saveEmailSendCodeTimes] key = ${cacheKey}`, ctx);
    }

    async getSendCodeTimes(cacheKey: string): Promise<{ count: number; time: string } | undefined> {
        const data = await this.redisService.getCacheData(cacheKey);
        if (!data) {
            return undefined;
        }
        const time = JSON.parse(data);
        if (time.count > (this.apiConfigService.getOtpConfig as any).maxTime) {
            throw new BadRequestException(StatusName.MAX_SEND_TIMES);
        }
        return time;
    }

    async getVerifyCodeData(ctx: RequestContext, cacheKey: string): Promise<any> {
        const data = await this.redisService.getCacheData(cacheKey);
        this.logger.log(`[getVerifyCodeData] key = ${cacheKey}`, ctx);
        if (!data) {
            return undefined;
        }
        const time = JSON.parse(data);
        time.count = time.count ? time.count + 1 : 1;
        if (time.count > (this.apiConfigService.getOtpConfig as any).maxVerifyTime) {
            throw new BadRequestException(StatusName.MAX_VERIFY_TIMES);
        }
        return time;
    }

    async updateVerifyCodeData(ctx: RequestContext, action: string, key: string): Promise<any> {
        const cacheKey = `otc_${action}_${key}`;
        await this.checkRequestsCount(ctx, cacheKey);
        const data = await this.getVerifyCodeData(ctx, cacheKey);
        if (!data) {
            throw new BadRequestException(StatusName.OTP_CODE_NOT_FIND);
        }
        await this.redisService.saveCacheData(cacheKey, JSON.stringify(data), TIME.HALF_HOUR);
        return data;
    }

    async validateOtpCode(ctx: RequestContext, action: string, key: string, code: string): Promise<void> {
        const codeData = await this.updateVerifyCodeData(ctx, action, key);
        if (codeData?.code !== code) {
            throw new BadRequestException(StatusName.OTP_CODE_ERROR);
        }
        await this.removeCacheKey(`otc_${action}_${key}`);
    }

    async checkRequestsCount(ctx: RequestContext, cacheKey: string): Promise<boolean> {
        const requestsCount = await this.redisService.getCacheData(cacheKey);
        const time = requestsCount ? Number(requestsCount) + 1 : 1;
        await this.redisService.saveCacheData(cacheKey, time, 2 * 60);
        this.logger.log(`[checkRequestsCount] key is ${cacheKey}`, ctx);
        if (time > 10) {
            throw new BadRequestException(StatusName.OPERATION_FREQUENT);
        }
        return true;
    }

    async generateUpAuthToken(email: string, action: string, ctx: RequestContext, key = 'defaultkey'): Promise<string> {
        const cacheKey = `ott_${action}_${email}_${key}`;
        const payload = { action, key: `${email}_${key}` };
        const jwtKey = randomBytes(16).toString('hex');
        const jwtToken = jwtSimple.encode(payload, jwtKey);
        const data = JSON.stringify({ jwtKey, jwtToken });
        await this.redisService.saveCacheData(cacheKey, data, TIME.HALF_HOUR);
        this.logger.log(`[generateUpAuthToken] key = ${cacheKey}`, ctx);
        return jwtToken;
    }

    async removeCacheKey(cacheKey: string): Promise<void> {
        await this.redisService.deleteCacheData(cacheKey);
    }

    async getUpAuthToken(action: string, email: string, key = 'defaultkey'): Promise<string> {
        const cacheKey = `ott_${action}_${email}_${key}`;
        const jwtKeyInfo = await this.redisService.getCacheData(cacheKey);
        if (!jwtKeyInfo) {
            this.logger.log(`[cacheKey] key data not find ${cacheKey}`);
            return '';
        }
        return JSON.parse(jwtKeyInfo).jwtToken;
    }

    async verifyUpAuthToken(upAuthToken: string, action: string, email: string, del: boolean, key = 'defaultkey'): Promise<boolean> {
        key = `${email}_${key}`;
        const cacheKey = `ott_${action}_${key}`;
        const data = await this.redisService.getCacheData(cacheKey);
        if (!data) {
            throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
        }
        const { jwtKey, jwtToken } = JSON.parse(data);
        if (jwtToken !== upAuthToken) {
            throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
        }
        const decoded = jwtSimple.decode(jwtToken, jwtKey) as { action: string; key: string };
        const isVerified = action === decoded.action && key === decoded.key;
        if (!isVerified) {
            throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
        }
        if (del) {
            await this.redisService.deleteCacheData(cacheKey);
        }
        return isVerified;
    }
}
