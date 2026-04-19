import { BadRequestException, Injectable } from '@nestjs/common';
import { generateSecret, otpauthURL, totp } from 'speakeasy';
import { StatusName, TIME, getQrData } from '../../shared/utils';

@Injectable()
export class GoogleAuthenticatorsService {
    constructor(logger: any, redisService: any, unipassConfigService: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.unipassConfigService = unipassConfigService;
        this.logger.setContext(GoogleAuthenticatorsService.name);
    }
    logger: any;
    redisService: any;
    unipassConfigService: any;
    async getGoogleAuthenticatorsQrCode(address: any, email: any, value: any) {
            const key = `ga_${address}`;
            let secret;
            if (!value) {
                const tepmData = await this.redisService.getCacheData(key);
                secret = tepmData
                    ? JSON.parse(tepmData)
                    : generateSecret({ length: 10 });
            }
            else {
                secret = JSON.parse(value);
            }
            await this.redisService.saveCacheData(key, JSON.stringify(secret), TIME.DAY);
            const url = otpauthURL({
                secret: secret.ascii,
                label: `UniPass_${email}`,
            });
            const qrPath = (await getQrData(url));
            return {
                secret: secret.base32,
                qrPath,
            };
        }
    async verifyGoogleAuthenticatorsToken(email: any, address: any, token: any, value: any, authValue: any) {
            const key = `ga_${address}`;
            if (!authValue) {
                authValue = await this.redisService.getCacheData(key);
            }
            if (!authValue) {
                throw new BadRequestException(StatusName.OTP_CODE_NOT_FIND);
            }
            const secret = JSON.parse(authValue);
            if (value && secret.base32 !== value) {
                throw new BadRequestException(StatusName.OTP_CODE_ERROR);
            }
            const isWhiteList = this.unipassConfigService.isTestWhiteList(email);
            this.logger.log(`[verifyGoogleAuthenticatorsToken] OtpBaseService: isWhiteList = ${isWhiteList} `);
            if (!isWhiteList) {
                const isVerified = totp.verify({
                    secret: secret.base32,
                    encoding: 'base32',
                    token,
                });
                if (!isVerified) {
                    throw new BadRequestException(StatusName.OTP_CODE_ERROR);
                }
            }
            await this.redisService.deleteCacheData(key);
            return JSON.stringify(secret);
        }
}
