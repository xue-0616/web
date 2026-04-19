import { Injectable } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';

@Injectable()
export class ProviderService {
    // Runtime-assigned fields (preserved from original source via decompilation).
    [key: string]: any;
    constructor(logger: any, apiConfigService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.logger.setContext(ProviderService.name);
        this.initContract();
    }
    logger: any;
    apiConfigService: any;
    initContract() {
            this.genProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.genNodeName}`);
            this.bsdProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.bscNodeName}`);
            this.rangersProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.rangersNodeNmae}`);
            this.ethProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.ethNodeName}`);
            this.scrollProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.scrollNodeName}`);
            this.arbitrumProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.arbitrumNodeName}`);
            this.platonProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.platonNodeName}`);
            this.kccProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.kccNodeName}`);
            this.avalancheProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.avalancheNodeName}`);
            this.okcProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.okcNodeName}`);
        }
    getProvider(nodeNmae: any) {
            switch (nodeNmae) {
                case this.apiConfigService.getContractConfig.bscNodeName:
                    return this.bsdProvider;
                case this.apiConfigService.getContractConfig.rangersNodeNmae:
                    return this.rangersProvider;
                case this.apiConfigService.getContractConfig.ethNodeName:
                    return this.ethProvider;
                case this.apiConfigService.getContractConfig.scrollNodeName:
                    return this.scrollProvider;
                case this.apiConfigService.getContractConfig.arbitrumNodeName:
                    return this.arbitrumProvider;
                case this.apiConfigService.getContractConfig.platonNodeName:
                    return this.platonProvider;
                case this.apiConfigService.getContractConfig.kccNodeName:
                    return this.kccProvider;
                case this.apiConfigService.getContractConfig.okcNodeName:
                    return this.okcProvider;
                case this.apiConfigService.getContractConfig.avalancheNodeName:
                    return this.avalancheProvider;
                default:
                    return this.genProvider;
            }
        }
}
