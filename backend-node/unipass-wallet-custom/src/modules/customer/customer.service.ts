import { Injectable } from '@nestjs/common';
import { concat, sha256, toUtf8Bytes } from 'ethers/lib/utils';
import { verifySign } from '../../shared/utils';

@Injectable()
export class CustomerService {
    constructor(customerDbService: any, logger: any, redisService: any, upJwtTokenService: any, apiConfigService: any, customAuthAppInfoDbService: any, appService: any) {
        this.customerDbService = customerDbService;
        this.logger = logger;
        this.redisService = redisService;
        this.upJwtTokenService = upJwtTokenService;
        this.apiConfigService = apiConfigService;
        this.customAuthAppInfoDbService = customAuthAppInfoDbService;
        this.appService = appService;
        this.logger.setContext(CustomerService.name);
    }
    customerDbService: any;
    logger: any;
    redisService: any;
    upJwtTokenService: any;
    apiConfigService: any;
    customAuthAppInfoDbService: any;
    appService: any;
    async insertOrUpdate(input: any) {
            const { timestamp, adminSig, status, provider, sub, gasTankBalance } = input;
            const message = concat([
                toUtf8Bytes(JSON.stringify({ status, provider, sub, gasTankBalance })),
            ]);
            const hash = sha256(message);
            const rawData = `${hash}:${timestamp}`;
            const adminAddress = this.apiConfigService.getAdminConfig.adminAddresses;
            await verifySign(adminSig, rawData, adminAddress, this.redisService, this.logger, timestamp);
            await this.customerDbService.insertToOrUpdateToBAppInfo(input);
            const authorization = this.getAuthorization(sub, provider);
            return { authorization };
        }
    getAuthorization(sub: any, provider: any, expirationInterval?: any) {
            const expiresIn = expirationInterval ? expirationInterval : '30d';
            const payload = {
                provider,
                sub,
                isCustomer: true,
                appId: '',
            };
            let authorization = '';
            const jwtToken = this.upJwtTokenService.createToken(payload, expiresIn);
            authorization = jwtToken.authorization;
            return authorization;
        }
}
