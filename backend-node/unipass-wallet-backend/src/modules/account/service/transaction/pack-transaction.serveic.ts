import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { SEND_TRANSACTION_JOB, SYNC_TRANSACTION_JOB, TIME, TRANSACTION_QUEUE } from '../../../../shared/utils';
import { SubTransactionType } from '../../../../interfaces';
import { AccountStatus } from '../../entities';
import { Keyset } from '@unipasswallet/keys';

@Injectable()
export class PackTransactionService {
    constructor(accountsDBService: any, unipassSubTransactionService: any, transactionWorkerService: any, logger: any, queryAbiService: any, @InjectQueue(TRANSACTION_QUEUE) transactionQueue: any) {
        this.accountsDBService = accountsDBService;
        this.unipassSubTransactionService = unipassSubTransactionService;
        this.transactionWorkerService = transactionWorkerService;
        this.logger = logger;
        this.queryAbiService = queryAbiService;
        this.transactionQueue = transactionQueue;
        this.logger.setContext(PackTransactionService.name);
    }
    accountsDBService: any;
    unipassSubTransactionService: any;
    transactionWorkerService: any;
    logger: any;
    queryAbiService: any;
    transactionQueue: any;
    async packTransaction(job: any) {
            const subTransactions = [];
            const jobId = [];
            const data = job.data;
            jobId.push(job.id);
            const subTransaction = await this.getJobSubTransaction(data);
            if (subTransaction) {
                const txHash = await this.transactionWorkerService.sendPackAccountTransaction(subTransaction, data.accountPrimaryKey.email, data.type);
                this.logger.log(`[packTransaction] txHash = ${txHash}`);
                const syncData = {
                    txdata: data,
                    txHash,
                    queryTime: 0,
                };
                if (txHash) {
                    await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData, {
                        delay: TIME.HALF_A_MINUTE * 1000,
                    });
                }
                else {
                    data.sendTime = data.sendTime ? data.sendTime + 1 : 1;
                    this.logger.log(`[packTransaction] resend sub tx to job send Time = ${data.sendTime}`);
                    if (!data.sendTime || data.sendTime <= 3) {
                        await this.transactionQueue.add(SEND_TRANSACTION_JOB, data);
                    }
                    else {
                        this.logger.log('[packTransaction] txHash is null, resend time > 3 sync account');
                        await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData);
                    }
                }
            }
            this.logger.log(`[packTransaction] subTransactions = ${subTransactions.length}`);
            return jobId;
        }
    async getJobSubTransaction(subTransaction: any) {
            const { type, data, accountPrimaryKey } = subTransaction;
            let transaction;
            switch (type) {
                case SubTransactionType.signUp:
                    transaction = await this.getSendSignUpSubTransaction(data, accountPrimaryKey);
                    break;
                case SubTransactionType.startRecovery:
                    transaction = await this.getStartRecoverySubTransaction(data, accountPrimaryKey);
                    break;
                case SubTransactionType.cancelRecovery:
                    transaction = this.getCancelRecoverySubTransaction(data, accountPrimaryKey);
                    break;
                case SubTransactionType.updateGuardian:
                    transaction = await this.getKeysetGuardianSubTransaction(data, accountPrimaryKey);
                    break;
                case SubTransactionType.completedRecovery:
                    transaction = await this.getCompleteRecoverySubTransaction(accountPrimaryKey);
                    break;
            }
            return transaction;
        }
    async getSendSignUpSubTransaction(signUpAccountInput: any, accountPrimaryKey: any) {
            const { email, provider } = accountPrimaryKey;
            this.logger.log(`[getSendSignUpSubTransaction] from ${JSON.stringify(accountPrimaryKey)}`);
            const { keysetJson } = signUpAccountInput;
            const account = (await this.accountsDBService.findOneInfo(email, provider));
            this.logger.log(`[getSendSignUpSubTransaction] AccountTransactionService account: ${account ? true : false}`);
            if (!account || account.status !== AccountStatus.committed) {
                const keyset = Keyset.fromJson(keysetJson);
                const deployTx = this.unipassSubTransactionService.getDeploySubTransaction(keyset);
                this.logger.log(`[getSetSourceSubTransaction] set account email = ${email}, address = ${account.address}, source = ${account.source}`);
                const moduleMainContract = this.queryAbiService.getModuleMainContract();
                const setSourceTx = this.unipassSubTransactionService.getSetSourceSubTransaction(moduleMainContract, account.address, account.source);
                const accountUpdate = {
                    status: AccountStatus.pending,
                    initKeysetHash: keyset.hash(),
                    updatedAt: new Date(),
                };
                await this.accountsDBService.updateDB(account.id, accountUpdate);
                return [deployTx, setSourceTx];
            }
            return undefined;
        }
    async getStartRecoverySubTransaction(data: any, accountPrimaryKey: any) {
            const { email, provider } = accountPrimaryKey;
            const { newKeysetHash } = data;
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account) {
                return undefined;
            }
            this.logger.log(`[getStartRecoverySubTransaction] from = ${JSON.stringify(accountPrimaryKey)} data= ${JSON.stringify(data)}`);
            const { targetMetaNonce: metaNonce } = await this.queryAbiService.aggregateChainData(account.address);
            this.logger.log(`[getStartRecoverySubTransaction]data= ${JSON.stringify(data)}`);
            try {
                const tx = await this.unipassSubTransactionService.getUpdateKeysetSubTransaction(data, account.address, metaNonce);
                this.logger.log(`updatePendingData from = ${JSON.stringify(accountPrimaryKey)} newKeysetHash ${newKeysetHash}`);
                await this.accountsDBService.updatePendingData(account.id, newKeysetHash);
                return tx;
            }
            catch (error) {
                this.logger.error(`[getStartRecoverySubTransaction] ${error},${(error as Error)?.stack},data = ${JSON.stringify(data)}`);
            }
        }
    getCancelRecoverySubTransaction(data: any, accountPrimaryKey: any) {
            const { transaction } = data;
            this.logger.log(`[getCancelRecoverySubTransaction] from ${JSON.stringify(accountPrimaryKey)}data= ${JSON.stringify(data)}`);
            const tx = this.unipassSubTransactionService.getCancelLockKeysetHashTransaction(transaction);
            return tx;
        }
    async getCompleteRecoverySubTransaction(accountPrimaryKey: any) {
            const { email, provider } = accountPrimaryKey;
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!(account === null || account === void 0 ? void 0 : account.pendingKeysetHash)) {
                this.logger.warn('[getCompleteRecoverySubTransaction] pendingKeysetHash is null stop return sub transaction');
                return;
            }
            const { targetMetaNonce: metaNonce } = await this.queryAbiService.aggregateChainData(account.address);
            const transaction = this.unipassSubTransactionService.getUnlockKeysetHashSubTransaction(account.address, metaNonce);
            return transaction;
        }
    async getKeysetGuardianSubTransaction(data: any, accountPrimaryKey: any) {
            const { newKeysetHash } = data;
            const { email, provider } = accountPrimaryKey;
            this.logger.log(`[getKeysetGuardianSubTransaction] from ${JSON.stringify(accountPrimaryKey)}`);
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account) {
                return undefined;
            }
            const { targetMetaNonce: metaNonce } = await this.queryAbiService.aggregateChainData(account.address);
            this.logger.log(`[updateKeysetGuardian]data= ${JSON.stringify(data)}`);
            const tx = await this.unipassSubTransactionService.getUpdateKeysetGuardianSubTransaction(data, account.address, metaNonce);
            this.logger.log(`updatePendingData from = ${JSON.stringify(accountPrimaryKey)} newKeysetHash ${newKeysetHash}`);
            await this.accountsDBService.updatePendingData(account.id, newKeysetHash);
            return tx;
        }
}
