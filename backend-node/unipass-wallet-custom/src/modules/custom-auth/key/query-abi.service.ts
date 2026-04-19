import { BadRequestException, Injectable } from '@nestjs/common';
import { RpcRelayer } from '@unipasswallet/relayer';
import { MAINNET_UNIPASS_WALLET_CONTEXT } from '@unipasswallet/network';
import { StatusName } from '../../../shared/utils';
import { Keyset } from '@unipasswallet/keys';
import { Wallet } from '@unipasswallet/wallet';

@Injectable()
export class QueryAbiService {
    constructor(logger: any, apiConfigService: any, providerService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.providerService = providerService;
        this.logger.setContext(QueryAbiService.name);
        this.initContract();
    }
    logger: any;
    apiConfigService: any;
    providerService: any;
    provider: any;
    relayer: any;
    initContract() {
            this.provider = this.providerService.getProvider('137');
            this.relayer = new RpcRelayer(this.apiConfigService.getContractConfig.rpcRelayerUrl, MAINNET_UNIPASS_WALLET_CONTEXT, this.provider);
        }
    async isUserRegistered(address: any, chainId: any) {
            try {
                const provider = this.providerService.getProvider(chainId);
                const code = provider
                    ? await provider.getCode(address)
                    : await this.provider.getCode(address);
                this.logger.log(`address:${address},code:${code} chainId =${chainId}`);
                return code !== '0x';
            }
            catch (error) {
                this.logger.error(`[provider] ${error},${(error as Error)?.stack} url = ${JSON.stringify({
                    url: this.provider.connection.url,
                    address,
                })}`);
                throw new BadRequestException(StatusName.PROVIDER_HTTP_ERROR);
            }
        }
    getContractAddressAndCheckRegistration(keysetJson: any) {
            const keyset = Keyset.fromJson(keysetJson);
            const wallet = Wallet.create({
                keyset,
                context: MAINNET_UNIPASS_WALLET_CONTEXT,
                provider: this.provider,
                relayer: this.relayer,
            });
            return wallet.address;
        }
    async getTransactionReceipt(txHash: any, chainId: any) {
            let status;
            const provider = this.providerService.getProvider(`${chainId}`);
            if (!provider) {
                this.logger.error(`getTransactionReceipt chainId ${chainId} provider not support`);
            }
            try {
                const receipt = await provider.getTransactionReceipt(txHash);
                status = receipt.status;
                this.logger.log(`[getTransactionReceipt] receipt: ${JSON.stringify(receipt)} status = ${status}`);
            }
            catch (error) {
                this.logger.warn(`[getTransactionReceipt] ${error}, data = ${JSON.stringify({
                    txHash,
                })}`);
            }
            return status;
        }
}
