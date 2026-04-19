import { Injectable } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';
import { ApiConfigService } from './api-config.service';

@Injectable()
export class ProviderService {
    apiConfigService;
    genProvider!: any;
    bscProvider!: any;
    rangersProvider!: any;
    ethProvider!: any;
    genTestnetProvider!: any;
    bscTestnetProvider!: any;
    rangersTestnetProvider!: any;
    ethTestnetProvider!: any;
    constructor(apiConfigService: ApiConfigService) {
        this.apiConfigService = apiConfigService;
        this.initContract();
    }
    initContract(): void {
        this.genProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.genNodeName}`);
        this.bscProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.bscNodeName}`);
        this.rangersProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.rangersNodeNmae}`);
        this.ethProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.ethNodeName}`);
        this.genTestnetProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.genTestnetNodeName}`);
        this.bscTestnetProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.bscTestnetNodeName}`);
        this.rangersTestnetProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.rangersTestnetNodeNmae}`);
        this.ethTestnetProvider = new JsonRpcProvider(`${this.apiConfigService.getContractConfig.rpcNodeUrl}/${this.apiConfigService.getContractConfig.ethTestnetNodeName}`);
    }
    getProvider(nodeNmae: any): JsonRpcProvider {
        switch (nodeNmae) {
            case this.apiConfigService.getContractConfig.bscNodeName:
                return this.bscProvider;
            case this.apiConfigService.getContractConfig.rangersNodeNmae:
                return this.rangersProvider;
            case this.apiConfigService.getContractConfig.ethNodeName:
                return this.ethProvider;
            case this.apiConfigService.getContractConfig.bscTestnetNodeName:
                return this.bscTestnetProvider;
            case this.apiConfigService.getContractConfig.rangersTestnetNodeNmae:
                return this.rangersTestnetProvider;
            case this.apiConfigService.getContractConfig.ethTestnetNodeName:
                return this.ethTestnetProvider;
            case this.apiConfigService.getContractConfig.genTestnetNodeName:
                return this.genTestnetProvider;
            default:
                return this.genProvider;
        }
    }
}
