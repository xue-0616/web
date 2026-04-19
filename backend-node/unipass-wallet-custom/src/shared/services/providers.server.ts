import { Injectable } from '@nestjs/common';
import { providers } from 'ethers';

@Injectable()
export class ProviderService {
    constructor(logger: any, apiConfigService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.providerMap = new Map();
        this.logger.setContext(ProviderService.name);
        this.initContract();
    }
    logger: any;
    apiConfigService: any;
    providerMap: any;
    initContract() {
            let nodeNames = this.apiConfigService.getContractConfig.nodeName;
            const chainLength = Object.keys(nodeNames).length;
            for (let index = 0; index < chainLength; index++) {
                const nodeName = Object.values(nodeNames)[index];
                const key = Object.keys(nodeNames)[index];
                const url = `${this.apiConfigService.getContractConfig.rpcNodeUrl}/${nodeName}`;
                this.providerMap.set(key, new providers.JsonRpcProvider(url));
            }
        }
    getProvider(chainId: any) {
            return this.providerMap.get(chainId);
        }
}
