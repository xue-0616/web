import { Injectable } from '@nestjs/common';
import { AddressOutput } from './dto/account.input';
import { getLogger } from '../common/logger/logger.helper';
import { Contract, providers, utils } from 'ethers';
import { MAINNET_UNIPASS_WALLET_CONTEXT } from '@unipasswallet/network';
import { moduleMain } from '@unipasswallet/abi';

@Injectable()
export class AccountService {
    constructor() {
        this.logger = getLogger('account');
        this.initContract();
    }
    private logger: any;
    private moduleMainContract: any;
    private genProvider: any;
    initContract(): void {
            this.genProvider = new providers.JsonRpcProvider('https://node.wallet.unipass.id/polygon-mainnet');
            this.moduleMainContract = new Contract(MAINNET_UNIPASS_WALLET_CONTEXT.moduleMain, moduleMain.abi, this.genProvider);
        }
    async getIsUniPassAccount(address: string): Promise<AddressOutput> {
            const proxyModuleMainContract = this.moduleMainContract.attach(address);
            if (address === '0x' || !utils.isAddress(address))
                return {
                    isUniPass: false,
                };
            try {
                const getImplementationAddress = await proxyModuleMainContract.getImplementation();
                const isUnipassAddress = getImplementationAddress ===
                    MAINNET_UNIPASS_WALLET_CONTEXT.moduleMain ||
                    getImplementationAddress ===
                        MAINNET_UNIPASS_WALLET_CONTEXT.moduleMainUpgradable;
                return {
                    isUniPass: isUnipassAddress,
                };
            }
            catch (error) {
                const e = error as Error;
                this.logger.warn(`[getIsUniPassAccount] ${e.message}, address = ${address}`);
                return {
                    isUniPass: false,
                };
            }
        }
}
