import { BadRequestException, Injectable } from '@nestjs/common';
import { RpcRelayer } from '@unipasswallet/relayer';
import { StatusName, TIME, getUnipassWalletContext, sleep } from '../../../../shared/utils';
import { Contract, JsonRpcProvider } from 'ethers';
import { dkimKeys, moduleMain } from '@unipasswallet/abi';
import { KeyEmailDkimSignType, Keyset, getDkimVerifyMessage } from '@unipasswallet/keys';
import { Wallet } from '@unipasswallet/wallet';
import { MAINNET_UNIPASS_WALLET_CONTEXT } from '@unipasswallet/network';

@Injectable()
export class QueryAbiService {
    // Runtime-assigned fields (preserved from original source via decompilation).
    [key: string]: any;
    constructor(logger: any, apiConfigService: any, providerService: any, accountsDBService: any, redisService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.providerService = providerService;
        this.accountsDBService = accountsDBService;
        this.redisService = redisService;
        this.logger.setContext(QueryAbiService.name);
        this.initContract();
    }
    logger: any;
    apiConfigService: any;
    providerService: any;
    accountsDBService: any;
    redisService: any;
    initContract() {
            this.provider = this.providerService.getProvider();
            this.relayer = new RpcRelayer(this.apiConfigService.getContractConfig.rpcRelayerUrl, getUnipassWalletContext(), this.provider);
            this.moduleMainContract = new Contract(getUnipassWalletContext().moduleMain, moduleMain.abi, this.provider);
            this.dkimKeysContract = new Contract(getUnipassWalletContext().dkimKeys, dkimKeys.abi, this.provider);
        }
    getModuleMainContract() {
            return this.moduleMainContract;
        }
    async getContractAddressAndCheckRegistration(keysetJson: any, isMainnet: any) {
            const keyset = Keyset.fromJson(keysetJson);
            const wallet = Wallet.create({
                keyset,
                context: isMainnet
                    ? MAINNET_UNIPASS_WALLET_CONTEXT
                    : getUnipassWalletContext(),
                provider: this.provider,
                relayer: this.relayer,
            });
            const isRegistered = await this.isUserRegistered(wallet.address);
            if (isRegistered) {
                this.logger.warn(`[getContractAddressAndCheckRegistration] account is =${isRegistered}`);
                throw new BadRequestException(StatusName.ACCOUNT_EXISTS);
            }
            return wallet.address;
        }
    async isUserRegistered(address: any) {
            try {
                const code = await this.provider.getCode(address);
                this.logger.log(`address:${address},code:${code}`);
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
    async getSource(address: any) {
            let source = '';
            const proxyModuleMainContract = this.moduleMainContract.attach(address);
            try {
                source = await proxyModuleMainContract.getSource();
            }
            catch (error) {
                this.logger.warn(`[getSource]${error}, data=${JSON.stringify({
                    address,
                })}`);
            }
            return source;
        }
    async isValidSignature(address: any, sig: any, sigMassage: any) {
            this.logger.log(`[isValidSignature] data = ${JSON.stringify({
                address,
                sig,
                sigMassage,
            })}`);
            let isVerified = false;
            try {
                const proxyModuleMainContract = this.moduleMainContract.attach(address);
                const ret = await proxyModuleMainContract.validateSignature(sigMassage, sig);
                isVerified = ret[0];
                this.logger.log(`[isValidSignature] isVerified = ${isVerified}`);
            }
            catch (error) {
                this.logger.error(`[isValidSignature] ${error},${(error as Error)?.stack},data=${JSON.stringify({
                    address,
                    sig,
                    sigMassage,
                })}`);
            }
            return isVerified;
        }
    async dkimVerify(params: any, inputEmailFrom: any, pepper: any) {
            const address = await this.accountsDBService.findOneAddress();
            this.logger.log(`[dkimVerify]===address: ${address} ,pepper=${pepper} inputEmailFrom=${inputEmailFrom} params = ${params.toString()}`);
            if (!address) {
                return [false];
            }
            try {
                const dkimVerify = await this.dkimKeysContract.functions.dkimVerify(0, getDkimVerifyMessage(params, KeyEmailDkimSignType.RawEmail, { pepper }));
                this.logger.log(`${dkimVerify}`);
                return dkimVerify;
            }
            catch (error) {
                this.logger.error(`[dkimVerify] ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    params,
                    inputEmailFrom,
                })}`);
                return [false];
            }
        }
    async getNonce(address: any) {
            let nonce = 0;
            try {
                const proxyModuleMainContract = this.moduleMainContract.attach(address);
                nonce = await proxyModuleMainContract.getNonce();
                this.logger.log(`[getNonce] metaNonce = ${nonce}`);
            }
            catch (error) {
                this.logger.warn(`[getNonce]${error}, data=${JSON.stringify({
                    address,
                })}`);
            }
            nonce = Number(nonce.toString()) + 1;
            this.logger.log(`${nonce}`);
            return nonce;
        }
    async getLockInfo(address: any) {
            let isPending = false;
            let newKeysetHash = '0x';
            let timestamp = 0;
            let lockDuringRet = 0;
            try {
                const proxyModuleMainContract = this.moduleMainContract.attach(address);
                const pendingStatus = await proxyModuleMainContract.getLockInfo();
                this.logger.log(`[getLockInfo] pendingStatus = :${pendingStatus}`);
                isPending = pendingStatus[0];
                lockDuringRet = pendingStatus[1];
                newKeysetHash = pendingStatus[2];
                if (!isPending) {
                    newKeysetHash = '0x';
                }
                else {
                    timestamp = pendingStatus[3].toNumber();
                }
                return { isPending, lockDuringRet, newKeysetHash, timestamp };
            }
            catch (error) {
                this.logger.warn(`[getLockInfo] ${error} , data=${JSON.stringify({
                    address,
                })}`);
                return { isPending, lockDuringRet, newKeysetHash, timestamp };
            }
        }
    async aggregateChainData(address: any, chainNode?: any) {
            let targetMetaNonce = 0;
            let targetKeysetHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
            if (!chainNode) {
                chainNode = this.apiConfigService.getContractConfig.genNodeName;
            }
            const rpcUrl = `${this.apiConfigService.getContractConfig.rpcNodeUrl}/${chainNode}`;
            try {
                const provider = new JsonRpcProvider(rpcUrl);
                const walletAbi = [
                    'function getMetaNonce() view returns (uint256)',
                    'function getKeysetHash() view returns (bytes32)',
                ];
                const walletContract = new Contract(address, walletAbi, provider);
                const [metaNonceRaw, keysetHash] = await Promise.all([
                    walletContract.getMetaNonce(),
                    walletContract.getKeysetHash(),
                ]);
                targetMetaNonce = Number(metaNonceRaw) + 1;
                targetKeysetHash = keysetHash;
            }
            catch (error) {
                this.logger.warn(`[aggregateChainData] ${error}, data=${JSON.stringify({
                    address,
                    chainNode,
                    rpcUrl,
                })}`);
            }
            this.logger.log(`[aggregateChainData] target info = ${JSON.stringify({
                targetMetaNonce,
                targetKeysetHash,
                chainNode,
            })}`);
            if (chainNode === this.apiConfigService.getContractConfig.genNodeName) {
                await this.redisService.saveCacheData(`${address}_meta_nonce`, targetMetaNonce.toString(), TIME.DAY);
            }
            return { targetMetaNonce, targetKeysetHash };
        }
    async getAccountInfo(address: any, currentKeysetHash: any) {
            const chainNode = this.apiConfigService.getContractConfig.genNodeName;
            const rpcUrl = `${this.apiConfigService.getContractConfig.rpcNodeUrl}/${chainNode}`;
            try {
                const provider = new JsonRpcProvider(rpcUrl);
                const walletAbi = [
                    'function getMetaNonce() view returns (uint256)',
                    'function getKeysetHash() view returns (bytes32)',
                    'function getLockInfo() view returns (bool isLockedRet, uint32 lockDuringRet, bytes32 lockedKeysetHashRet, uint256 unlockAfterRet)',
                    'function isValidKeysetHash(bytes32) view returns (bool)',
                ];
                const walletContract = new Contract(address, walletAbi, provider);
                const callPromises: Promise<any>[] = [
                    walletContract.getMetaNonce(),
                    walletContract.getKeysetHash(),
                    walletContract.getLockInfo(),
                ];
                if (currentKeysetHash) {
                    callPromises.push(walletContract.isValidKeysetHash(currentKeysetHash));
                }
                const [metaNonceRaw, keysetHashRaw, lockInfoRaw, isValidRaw] = await Promise.all(callPromises);
                let keysetHash = keysetHashRaw;
                const metaNonce = Number(metaNonceRaw) + 1;
                const isPending = lockInfoRaw.isLockedRet;
                const newKeysetHash = lockInfoRaw.lockedKeysetHashRet;
                const unlockTime = Number(lockInfoRaw.unlockAfterRet);
                const lockDuration = lockInfoRaw.lockDuringRet;
                if (currentKeysetHash && isValidRaw === true) {
                    keysetHash = currentKeysetHash;
                }
                const accountChainInfo = {
                    isPending,
                    pendingKeysetHash: newKeysetHash,
                    keysetHash,
                    unlockTime,
                    lockDuration,
                    metaNonce,
                };
                this.logger.log(`[getAccountInfo] address=${address} data = ${JSON.stringify(accountChainInfo)}`);
                return accountChainInfo;
            }
            catch (error) {
                this.logger.warn(`[getAccountInfo] ${error}, data=${JSON.stringify({
                    address,
                    chainNode,
                    rpcUrl,
                })}`);
            }
        }
    async getTransactionHash(key: any, timeout: any = 20) {
            let transactionHash = '';
            for (let index = 0; index < timeout; index++) {
                await sleep(2000);
                transactionHash = (await this.redisService.getCacheData(key));
                this.logger.log(`[getTransactionHash] transactionHash = :${transactionHash} index = ${index}`);
                if (!transactionHash) {
                    continue;
                }
                await this.redisService.deleteCacheData(key);
                return transactionHash;
            }
            return transactionHash;
        }
    async getGenMetaNonce(address: any, update: any) {
            const genMetaNonce = await this.redisService.getCacheData(`${address}_meta_nonce`);
            let genChainMetaNonce = 0;
            if (genMetaNonce && !update) {
                genChainMetaNonce = Number(genMetaNonce);
            }
            else {
                const data = await this.aggregateChainData(address);
                genChainMetaNonce = data.targetMetaNonce;
            }
            this.logger.log(`[getGenMetaNonce] genChainMetaNonce = :${genChainMetaNonce}`);
            return genChainMetaNonce;
        }
    async getTxFailedEventTopic(address: any) {
            if (!address) {
                address = await this.accountsDBService.findOneAddress();
            }
            const proxyModuleMainContract = this.moduleMainContract.attach(address);
            const txFailedEvent = proxyModuleMainContract.filters.TxFailedEvent();
            const topics = txFailedEvent.topics;
            return topics[0];
        }
}
