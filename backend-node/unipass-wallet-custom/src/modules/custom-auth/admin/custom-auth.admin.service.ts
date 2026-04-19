import { Injectable } from '@nestjs/common';
import { concat, sha256, toUtf8Bytes } from 'ethers/lib/utils';
import { SIG_PREFIX, verifySign } from '../../../shared/utils';
import { v5 } from 'uuid';

@Injectable()
export class CustomAuthAdminService {
    constructor(logger: any, redisService: any, customAuthAppInfoDbService: any, apiConfigService: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.customAuthAppInfoDbService = customAuthAppInfoDbService;
        this.apiConfigService = apiConfigService;
        logger.setContext(CustomAuthAdminService.name);
    }
    logger: any;
    redisService: any;
    customAuthAppInfoDbService: any;
    apiConfigService: any;
    async insertOrUpdate(input: any) {
            let appId = input.appId;
            const { appName, jwtPubkey, timestamp, appInfo, jwtVerifierIdKey, adminSig, verifierName, web3authClientId, web3authEnv, callbackUrl, customPolicyPublicKey, enableCustomPolicy, customerId, } = input;
            const message = concat([
                toUtf8Bytes(JSON.stringify({
                    jwtPubkey,
                    appName,
                    jwtVerifierIdKey,
                    verifierName,
                    web3authClientId,
                    appId,
                    web3authEnv,
                    callbackUrl,
                    customPolicyPublicKey,
                    enableCustomPolicy,
                    customerId,
                })),
            ]);
            const hash = sha256(message);
            const rawData = `${SIG_PREFIX.TO_B_APP}${hash}:${timestamp}`;
            const adminAddress = this.apiConfigService.getAdminConfig.adminAddresses;
            await verifySign(adminSig, rawData, adminAddress, this.redisService, this.logger, timestamp);
            let name = `${appName}:${timestamp}`;
            if (!appId) {
                appId = v5(name, v5.DNS).replace(new RegExp('-', 'g'), '');
            }
            await this.customAuthAppInfoDbService.insertToOrUpdateToBAppInfo({
                appId,
                appName,
                jwtPubkey,
                appInfo,
                jwtVerifierIdKey,
                verifierName,
                web3authClientId,
                web3authEnv,
                callbackUrl,
                customPolicyPublicKey,
                enableCustomPolicy,
                customerId,
            });
            return {
                appId,
            };
        }
}
