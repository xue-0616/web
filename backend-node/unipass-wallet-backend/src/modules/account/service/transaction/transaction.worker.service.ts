import { Injectable } from '@nestjs/common';
// ethers v6: BigNumber removed — use native BigInt
import { RpcRelayer } from '@unipasswallet/relayer';
import { getUnipassWallet, getUnipassWalletContext, sleep } from '../../../../shared/utils';
import { Wallet } from '@unipasswallet/wallet';

@Injectable()
export class TransactionWorkerService {
    // Runtime-assigned fields (preserved from original source via decompilation).
    [key: string]: any;
    constructor(logger: any, apiConfigService: any, providerService: any, queryAbiService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.providerService = providerService;
        this.queryAbiService = queryAbiService;
        this.logger.setContext(TransactionWorkerService.name);
        this.initContract();
    }
    logger: any;
    apiConfigService: any;
    providerService: any;
    queryAbiService: any;
    initContract() {
            this.provider = this.providerService.getProvider();
            this.wallet = new Wallet(this.apiConfigService.getContractConfig.privateKey, this.provider);
            this.relayer = new RpcRelayer(this.apiConfigService.getContractConfig.rpcRelayerUrl, getUnipassWalletContext(), this.provider);
        }
    initUnipassWallet() {
            if (this.unipassWallet) {
                return this.unipassWallet;
            }
            const keyset = getUnipassWallet(this.wallet);
            const unipassWallet = Wallet.create({
                keyset,
                context: getUnipassWalletContext(),
                provider: this.provider,
                relayer: this.relayer,
            });
            this.unipassWallet = unipassWallet;
            return this.unipassWallet;
        }
    async getTransactionReceipt(txHash: any, index: any = 0, time: any = 30) {
            index++;
            let status = 404;
            if (index > time) {
                return status;
            }
            const { chainId } = await this.provider.getNetwork();
            this.logger.log(`[getTransactionReceipt] chainId ${chainId}, txHash=${txHash}, index=${index}`);
            try {
                const receipt = await this.provider.getTransactionReceipt(txHash);
                if (!receipt) {
                    await sleep(1000);
                    return this.getTransactionReceipt(txHash, index);
                }
                status = await this.parseReceipt(receipt);
                this.logger.log(`[getTransactionReceipt] receipt: ${JSON.stringify(receipt)} status = ${status}`);
            }
            catch (error) {
                this.logger.warn(`[getTransactionReceipt] ${error}, data = ${JSON.stringify({
                    txHash,
                    index,
                    time,
                })}`);
            }
            return status;
        }
    async parseReceipt(receipt: any) {
            const logs = receipt.logs;
            const txFailedEventTopic = await this.queryAbiService.getTxFailedEventTopic();
            let state = receipt.status;
            for (const item of logs) {
                if (item.topics.includes(txFailedEventTopic)) {
                    state = 0;
                }
            }
            return state;
        }
    async sendPackAccountTransaction(tx: any, email: any, type: any) {
            let hash = '';
            this.initUnipassWallet();
            const baseGasLimit = String(700000);
            try {
                this.logger.log(`[sendPackTransaction]: email=${email},type=${type}, sub tx data = ${JSON.stringify(tx)}`);
                const data = await this.unipassWallet.sendTransaction({
                    type: 'Bundled',
                    transactions: tx,
                    gasLimit: BigInt(baseGasLimit),
                    revertOnError: true,
                });
                hash = data.hash;
                this.logger.log(`[sendPackTransaction]: email=${email},type=${type}, tx bundled data = ${JSON.stringify(data)} `);
            }
            catch (error) {
                this.logger.error(`[sendPackTransaction] ${JSON.stringify(error)},${(error as Error)?.stack} data = ${JSON.stringify({
                    tx,
                    email,
                    type,
                })} `);
            }
            return hash;
        }
}
