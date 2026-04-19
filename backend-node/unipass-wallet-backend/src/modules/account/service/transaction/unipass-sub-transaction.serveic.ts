import { Injectable } from '@nestjs/common';
import { RpcRelayer } from '@unipasswallet/relayer';
import { buildDkimSigKeyset, buildSyncAccountKeyset, getMasterSigKeyset, getUnipassWalletContext } from '../../../../shared/utils';
import { Wallet, getWalletDeployTransaction } from '@unipasswallet/wallet';
import { CallTxBuilder, SyncAccountTxBuilder, UnlockKeysetHashTxBuilder, UpdateKeysetHashTxBuilder, UpdateKeysetHashWithTimeLockTxBuilder } from '@unipasswallet/transaction-builders';
import { ZeroAddress } from 'ethers';
import { Keyset } from '@unipasswallet/keys';
import { encodeBytes32String } from 'ethers';

@Injectable()
export class UnipassSubTransactionService {
    constructor(logger: any, providerService: any, apiConfigService: any) {
        this.logger = logger;
        this.providerService = providerService;
        this.apiConfigService = apiConfigService;
        this.logger.setContext(UnipassSubTransactionService.name);
        this.provider = this.providerService.getProvider();
        this.relayer = new RpcRelayer(this.apiConfigService.getContractConfig.rpcRelayerUrl, getUnipassWalletContext(), this.provider);
    }
    logger: any;
    providerService: any;
    apiConfigService: any;
    provider: any;
    relayer: any;
    getDeploySubTransaction(keyset: any) {
            const deployTx = getWalletDeployTransaction(getUnipassWalletContext(), keyset.hash());
            deployTx.revertOnError = true;
            this.logger.log(`[getDeploySubTransaction]: deployTx = ${JSON.stringify(deployTx)}`);
            return deployTx;
        }
    getUnlockKeysetHashSubTransaction(address: any, metaNonce: any) {
            const tx = new UnlockKeysetHashTxBuilder(address, metaNonce, true).build();
            return tx;
        }
    getCancelLockKeysetHashTransaction(localTransaction: any) {
            const transaction = {
                _isUnipassWalletTransaction: true,
                callType: localTransaction.callType,
                data: localTransaction.data,
                revertOnError: true,
                gasLimit: BigInt(localTransaction.gasLimit),
                target: localTransaction.target,
                value: BigInt(localTransaction.value),
            };
            return transaction;
        }
    async getUpdateKeysetSubTransaction(data: any, address: any, metaNonce: any) {
            var _a;
            const { zkParams, emailHeaderParams, newKeysetHash, isHaveTimeLock, isPolicy, oldKeyset, idToken, email, } = data;
            const txBuilder = isHaveTimeLock
                ? new UpdateKeysetHashWithTimeLockTxBuilder(address, metaNonce, newKeysetHash, true)
                : new UpdateKeysetHashTxBuilder(address, metaNonce, newKeysetHash, true);
            const keysetData = Keyset.fromJson(oldKeyset.keyset);
            const { keyset, keyIndexList } = buildDkimSigKeyset(keysetData, zkParams, emailHeaderParams, isPolicy, email, idToken);
            const wallet = new Wallet({
                address,
                keyset,
                provider: this.provider,
                relayer: this.relayer,
            });
            const tx = (await txBuilder.generateSignature(wallet, keyIndexList)).build();
            this.logger.log(`[getUpdateKeysetSubTransaction] UnipassSubTransactionService data = ${JSON.stringify(tx)}`);
            const nonce = await ((_a = wallet.relayer) === null || _a === void 0 ? void 0 : _a.getNonce(wallet.address));
            const transactionData = await wallet.toTransaction({
                type: 'Execute',
                transactions: [tx],
                sessionKeyOrSignerIndex: [],
                gasLimit: 0n,
            }, nonce);
            const subTx = transactionData[0];
            subTx.revertOnError = true;
            return subTx;
        }
    async getUpdateKeysetGuardianSubTransaction(data: any, address: any, metaNonce: any) {
            var _a;
            const { newKeysetHash, oldKeyset, masterKeySig } = data;
            const txBuilder = new UpdateKeysetHashTxBuilder(address, metaNonce, newKeysetHash, true);
            const keysetData = Keyset.fromJson(oldKeyset.keyset);
            const { keyset, keyIndexList } = getMasterSigKeyset(keysetData, masterKeySig);
            const wallet = new Wallet({
                address,
                keyset,
                provider: this.provider,
                relayer: this.relayer,
            });
            const tx = (await txBuilder.generateSignature(wallet, keyIndexList)).build();
            this.logger.log(`[getUpdateKeysetGuardianSubTransaction] UnipassSubTransactionService data = ${JSON.stringify(tx)}`);
            const nonce = await ((_a = wallet.relayer) === null || _a === void 0 ? void 0 : _a.getNonce(wallet.address));
            const transactionData = await wallet.toTransaction({
                type: 'Execute',
                transactions: [tx],
                sessionKeyOrSignerIndex: [],
                gasLimit: 0n,
            }, nonce);
            const subTx = transactionData[0];
            subTx.revertOnError = true;
            return subTx;
        }
    getDeployTransaction(initKeysetHash: any) {
            this.logger.log(`[getDeployTransaction] add  initKeysetHash = ${initKeysetHash}`);
            const deployTx = getWalletDeployTransaction(getUnipassWalletContext(), initKeysetHash);
            deployTx.revertOnError = false;
            return deployTx;
        }
    async getSyncTransaction(metaNonce: any, address: any, keysetJson: any, implementationAddress: any, lockDuringRet: any, keysetHash: any, zKParams: any, dkimParamsString: any, idToken: any) {
            metaNonce = metaNonce - 1;
            const keysetData = Keyset.fromJson(keysetJson);
            const txBuilder = new SyncAccountTxBuilder(address, metaNonce, keysetHash, lockDuringRet, implementationAddress, true);
            const { keyset, keyIndexList } = buildSyncAccountKeyset(keysetData, zKParams, dkimParamsString, idToken);
            this.logger.log(`[getSyncTransaction] add  keyset = ${keyset.toJson()}`);
            const wallet = new Wallet({
                address,
                keyset,
                provider: this.provider,
            });
            try {
                const tx = (await txBuilder.generateSignature(wallet, keyIndexList)).build();
                return tx;
            }
            catch (error) {
                this.logger.error(`[getSyncTransaction] ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    address,
                    metaNonce,
                    keysetHash,
                    oldKeysetHash: keyset.hash(),
                })}`);
            }
            return undefined;
        }
    getSetSourceSubTransaction(moduleMainContract: any, userAddress: any, source: any) {
            const proxyModuleMainContract = moduleMainContract.attach(userAddress);
            const tx = new CallTxBuilder(true, 0n, userAddress, 0n, proxyModuleMainContract.interface.encodeFunctionData('setSource', [
                encodeBytes32String(source),
            ])).build();
            return tx;
        }
    async getFeeSubTransaction(unipassWallet: any, txLength: any = 1) {
            var _a;
            const baseGasLimit = String(400000 * txLength);
            this.logger.log(`[getFeeSubTransaction]: start baseGasLimit=${baseGasLimit}`);
            const getGasPrice = await this.provider.getGasPrice();
            this.logger.log(`[getFeeSubTransaction]: start getGasPrice=${getGasPrice}`);
            const feeOptions = await ((_a = unipassWallet.relayer) === null || _a === void 0 ? void 0 : _a.getFeeOptions(BigInt(baseGasLimit).toString(16)));
            this.logger.log(`[getFeeSubTransaction]: start feeOptions = ${JSON.stringify(feeOptions)}`);
            const optionsList = feeOptions === null || feeOptions === void 0 ? void 0 : feeOptions.options;
            const options = optionsList.find((x: any) => !x.token.contractAddress);
            this.logger.log(`[getFeeSubTransaction]:  fee_options = ${JSON.stringify(options)}`);
            const feeToken = options.to;
            const amount = options.amount;
            this.logger.log(`[getFeeSubTransaction]:  fee_options = ${JSON.stringify(options)}`);
            const feeTx = new CallTxBuilder(true, 0n, feeToken, BigInt(amount), '0x').build();
            return feeTx;
        }
}
