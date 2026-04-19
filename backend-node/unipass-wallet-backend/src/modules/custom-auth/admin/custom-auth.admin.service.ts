import { Injectable } from '@nestjs/common';
import { SIG_PREFIX } from '../../../shared/utils';
import { v5 } from 'uuid';

@Injectable()
export class CustomAuthAdminService {
    constructor(logger: any, customAuthAppInfoDbService: any, apiConfigService: any, actionPointService: any) {
        this.logger = logger;
        this.customAuthAppInfoDbService = customAuthAppInfoDbService;
        this.apiConfigService = apiConfigService;
        this.actionPointService = actionPointService;
        logger.setContext(CustomAuthAdminService.name);
    }
    logger: any;
    customAuthAppInfoDbService: any;
    apiConfigService: any;
    actionPointService: any;
    async insertOrUpdate(input: any) {
            let appId = input.appId;
            const { appName, jwtPubkey, timestamp, appInfo, jwtVerifierIdKey, adminSig, verifierName, web3authClientId, } = input;
            const rawData = `${SIG_PREFIX.TO_B_APP}${timestamp}:${appName}`;
            const adminAddress = this.apiConfigService.getApConfig.adminAddresses;
            await this.actionPointService.verifySign(adminSig, rawData, adminAddress, timestamp);
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
            });
            const data = await this.customAuthAppInfoDbService.getAppId(appName);
            return data;
        }
}
