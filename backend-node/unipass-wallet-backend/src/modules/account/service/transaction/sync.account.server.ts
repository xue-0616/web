import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ACCOUNT_QUEUE, MSG, SEND_NOTIFY_EMAIL_JOB, SEND_TRANSACTION_JOB, SYNC_TRANSACTION_JOB, TIME, TRANSACTION_QUEUE, getKeysetEmailPepperInfo, initPepperTemplate } from '../../../../shared/utils';
import moment from 'moment';
import { QueryAbiService } from './query-abi.service';
import { AccountStatus, KeyStatus } from '../../entities';
import { RequestContext, SubTransactionType, TemplateType } from '../../../../interfaces';
import { encodeBytes32String } from 'ethers';

@Injectable()
export class SyncAccountService {
    // Runtime-assigned fields (preserved from original source via decompilation).
    [key: string]: any;
    constructor(apiConfigService: any, accountsDBService: any, keyService: any, logger: any, loginRecordsDBService: any, redisService: any, oriHashDBService: any, queryAbiService: any, transactionWorkerService: any, httpService: any, @InjectQueue(ACCOUNT_QUEUE) accountQueue: any, @InjectQueue(TRANSACTION_QUEUE) transactionQueue: any) {
        this.apiConfigService = apiConfigService;
        this.accountsDBService = accountsDBService;
        this.keyService = keyService;
        this.logger = logger;
        this.loginRecordsDBService = loginRecordsDBService;
        this.redisService = redisService;
        this.oriHashDBService = oriHashDBService;
        this.queryAbiService = queryAbiService;
        this.transactionWorkerService = transactionWorkerService;
        this.httpService = httpService;
        this.accountQueue = accountQueue;
        this.transactionQueue = transactionQueue;
        this.logger.setContext(QueryAbiService.name);
    }
    apiConfigService: any;
    accountsDBService: any;
    keyService: any;
    logger: any;
    loginRecordsDBService: any;
    redisService: any;
    oriHashDBService: any;
    queryAbiService: any;
    transactionWorkerService: any;
    httpService: any;
    accountQueue: any;
    transactionQueue: any;
    async syncAccountByUserSync(email: any, provider: any, isActive?: any, tss: any = TIME.ONE_MINUTE) {
            const key = `sync_${email}_${provider}`;
            let account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account || account.status === AccountStatus.migrated) {
                this.logger.log(`sync account ${key} account not find`);
                return account;
            }
            const { address, status, pendingKeysetHash, pendingCreatedAt } = account;
            const { keysetHash } = account;
            if (isActive) {
                const isSync = await this.redisService.getCacheData(key);
                if (isSync) {
                    this.logger.log(`sync account ${key} is synced`);
                    return account;
                }
            }
            this.logger.log(`sync account ${key} status is ${status} pendingKeysetHash is ${pendingKeysetHash} pendingCreatedAt ${pendingCreatedAt}`);
            if (!account.pendingKeysetHash &&
                account.status === AccountStatus.committed) {
                this.logger.log(`account no synchronization required ${key}`);
                return account;
            }
            const accountInfo = await this.queryAbiService.getAccountInfo(address, keysetHash);
            this.logger.log(`sync account ${key} chain info = ${JSON.stringify(accountInfo)}`);
            if (!accountInfo) {
                return account;
            }
            account = await this.syncAccount(accountInfo, account, key);
            await this.redisService.saveCacheData(key, 'true', tss);
            return account;
        }
    async syncAccount(accountInfo: any, account: any, key: any) {
            const status = AccountStatus.committed;
            const { email, initKeysetHash, provider } = account;
            let { keysetHash } = account;
            let pendingKeysetHash;
            let pendingCreatedAt = account.pendingCreatedAt;
            const { isPending, keysetHash: targetKeysetHash, pendingKeysetHash: newKeysetHash, unlockTime, lockDuration, } = accountInfo;
            let diff = 0;
            let isCover = false;
            if (pendingCreatedAt) {
                diff = moment().diff(moment(pendingCreatedAt), 's');
                isCover = diff > lockDuration;
                this.logger.log(`sync account ${key} pendingKeysetHas diff now = ${diff}, isCover = ${isCover}`);
            }
            if (!isCover &&
                (targetKeysetHash !== account.pendingKeysetHash ||
                    targetKeysetHash === keysetHash) &&
                account.status === AccountStatus.committed) {
                this.logger.log(`sync account ${key} not sync pendingKeysetHas=${account.pendingKeysetHash},
            keysetHash=${keysetHash},targetKeysetHash ${keysetHash}`);
                return account;
            }
            if (targetKeysetHash ===
                '0x0000000000000000000000000000000000000000000000000000000000000000') {
                keysetHash = initKeysetHash;
            }
            else {
                await this.oriHashDBService.getKeyset(targetKeysetHash);
                keysetHash = targetKeysetHash;
            }
            if (isPending) {
                await this.oriHashDBService.getKeyset(newKeysetHash);
                pendingKeysetHash = newKeysetHash;
            }
            else {
                pendingKeysetHash = undefined;
                pendingCreatedAt = undefined;
            }
            if (isPending && moment().unix() - unlockTime > 0) {
                const subTransaction = {
                    type: SubTransactionType.completedRecovery,
                    data: { email, keysetHash: targetKeysetHash },
                    accountPrimaryKey: { email, provider },
                };
                await this.transactionQueue.add(SEND_TRANSACTION_JOB, subTransaction);
            }
            const beforSyncStatus = account.status;
            account = await this.syncSyncDBStatus(account, status, keysetHash, pendingKeysetHash, pendingCreatedAt);
            this.logger.log(`sync account ${key} chain info = ${JSON.stringify(accountInfo)} completed`);
            if (beforSyncStatus === AccountStatus.pending) {
                this.logger.log(`buried point event = sync_account_status email = ${key} status = committed`);
            }
            return account;
        }
    async syncSyncDBStatus(account: any, status: any, keysetHash: any, pendingKeysetHash: any, pendingCreatedAt: any) {
            const accountUpdate = {
                status,
                keysetHash,
                pendingKeysetHash,
                updatedAt: new Date(),
                pendingCreatedAt,
            };
            const keyset = await this.oriHashDBService.getKeyset(keysetHash);
            await this.accountsDBService.updateDB(account.id, accountUpdate);
            await this.keyService.updateKeyStatus(account.id, keyset.masterKeyAddress, KeyStatus.committed);
            account = (await this.accountsDBService.findOneInfo(account.email, account.provider));
            return account;
        }
    async get(txHash: any, queryTime: any) {
            var _a;
            let transactionHash = '';
            if (!txHash) {
                return transactionHash;
            }
            const url = `${this.apiConfigService.getContractConfig.rpcRelayerUrl}tx_receipt/${txHash}`;
            try {
                const result = await this.httpService.get(url).toPromise();
                this.logger.log(`[get] SyncAccountService relayer result, ${JSON.stringify(result === null || result === void 0 ? void 0 : result.data)} queryTime = ${queryTime},url=${url}`);
                const data = result === null || result === void 0 ? void 0 : result.data;
                transactionHash = (_a = data.data) === null || _a === void 0 ? void 0 : _a.receipt.transactionHash;
            }
            catch (error) {
                this.logger.error(`[get]${JSON.stringify(error)},data=${JSON.stringify({
                    url,
                    queryTime,
                })}`);
            }
            return transactionHash;
        }
    async updateAccountTransaction(syncData: any) {
            const { txHash, txdata } = syncData;
            const { accountPrimaryKey } = txdata;
            const { email, provider } = accountPrimaryKey;
            if (!txHash) {
                this.logger.warn(`[updateAccountTransaction] sync sub txHash not find, sync timeout,job stop, sync data = ${JSON.stringify(syncData)} rollback pending keyset`);
                await this.rollbackPendingKeysetHash(email, provider, txdata.type);
                return;
            }
            let { queryTime } = syncData;
            queryTime = queryTime ? ++queryTime : 1;
            if (queryTime >= 120) {
                this.logger.error(`[updateAccountTransaction] query time > 120, sync timeout,job stop, sync data = ${JSON.stringify(syncData)}`);
                await this.syncAccountByUserSync(email, provider);
                return;
            }
            const transactionHash = await this.get(txHash, queryTime);
            if (!transactionHash) {
                syncData.queryTime = queryTime;
                await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData, {
                    delay: TIME.HALF_A_MINUTE * 1000,
                });
                return;
            }
            const status = await this.transactionWorkerService.getTransactionReceipt(transactionHash);
            if (status === 0) {
                this.logger.error(`[updateAccountTransaction] txFailed  transactionHash = ${transactionHash} txSyncData = ${syncData}`);
                await this.rollbackPendingKeysetHash(email, provider, txdata.type);
                return;
            }
            if (status === 404) {
                await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData, {
                    delay: TIME.HALF_A_MINUTE * 1000,
                });
                return;
            }
            const txData = {
                transactionHash,
                status,
            };
            const account = await this.syncAccountByUserSync(email, provider);
            this.logger.log(`[updateAccountTransaction] ${email}_${provider} sync done type=${txdata.type}`);
            await this.notifyAccountUpdate(txdata, account, syncData, txData);
            this.logger.log(`[updateAccountTransaction] ${email}_${provider} notify done type=${txdata.type}`);
        }
    async notifyAccountUpdate(subTransaction: any, account: any, syncData: any, txData: any) {
            let cacheKey = '';
            const { type, data, accountPrimaryKey } = subTransaction;
            const { email, provider } = accountPrimaryKey;
            switch (type) {
                case SubTransactionType.signUp:
                    if ((account === null || account === void 0 ? void 0 : account.keysetHash) !== data.keysetHash) {
                        await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData, {
                            delay: TIME.HALF_A_MINUTE * 1000,
                        });
                        return;
                    }
                    await this.getSourceFromChainData(accountPrimaryKey);
                    break;
                case SubTransactionType.startRecovery:
                    if (!data.isHaveTimeLock &&
                        (account === null || account === void 0 ? void 0 : account.keysetHash) !== data.newKeysetHash) {
                        await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData, {
                            delay: TIME.HALF_A_MINUTE * 1000,
                        });
                        return;
                    }
                    cacheKey = `start_recovery_${email}_${provider}`;
                    await this.updateStartRecovery(data, txData, accountPrimaryKey, account);
                    break;
                case SubTransactionType.cancelRecovery:
                    cacheKey = `cancel_recovery_${email}_${provider}`;
                    await this.updateCancelRecovery(txData, accountPrimaryKey);
                    break;
                case SubTransactionType.updateGuardian:
                    if ((account === null || account === void 0 ? void 0 : account.keysetHash) !== data.newKeysetHash) {
                        await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData, {
                            delay: TIME.HALF_A_MINUTE * 1000,
                        });
                        return;
                    }
                    cacheKey = `update_guardian_tx_${email}_${provider}`;
                    await this.updateKeysetGuardian(txData, accountPrimaryKey, data);
                    break;
                case SubTransactionType.completedRecovery:
                    if ((account === null || account === void 0 ? void 0 : account.keysetHash) !== data.keysetHash) {
                        await this.transactionQueue.add(SYNC_TRANSACTION_JOB, syncData, {
                            delay: TIME.HALF_A_MINUTE * 1000,
                        });
                        return;
                    }
                    await this.completeRecovery(accountPrimaryKey, txData);
                    break;
            }
            if (cacheKey && txData.status === 1) {
                await this.redisService.saveCacheData(cacheKey, txData.transactionHash, TIME.ONE_MINUTE);
            }
        }
    async getSourceFromChainData(accountPrimaryKey: any) {
            const { email, provider } = accountPrimaryKey;
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account) {
                return;
            }
            await this.loginRecordsDBService.insertDB(account.id);
            const chainSource = await this.queryAbiService.getSource(account.address);
            this.logger.log(`[getSourceFromChainData] source = ${account.source} chainSource = ${chainSource} hash = ${encodeBytes32String(account.source)} from ${JSON.stringify(accountPrimaryKey)}`);
            const { address, pepper } = account;
            const detail = initPepperTemplate([{ email, pepper }]);
            await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                email,
                body: address,
                detail,
                subject: MSG.NOTIFY_REGISTER_SUCCESS,
                notifyType: TemplateType.accountInfo,
            });
        }
    async updateDbData(accountId: any, masterKey: any, keysetHash: any) {
            const accountUpdate = {
                status: AccountStatus.committed,
                initKeysetHash: keysetHash,
                keysetHash,
                updatedAt: new Date(),
            };
            await this.accountsDBService.updateDB(accountId, accountUpdate);
            await this.keyService.updateKeyStatus(accountId, masterKey.masterKeyAddress, KeyStatus.committed);
        }
    async updateStartRecovery(data: any, txData: any, accountPrimaryKey: any, account: any) {
            const { status } = txData;
            const { email, provider } = accountPrimaryKey;
            const { ctx, isHaveTimeLock, newKeysetHash } = data;
            this.logger.log(`[updateStartRecovery] from = ${JSON.stringify(accountPrimaryKey)} status= ${status} isHaveTimeLock = ${isHaveTimeLock}`);
            if (status === 0) {
                await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                    email,
                    ctx,
                    body: MSG.EMAIL_RECOVERY_FAIL,
                });
                return;
            }
            await this.redisService.saveCacheData(`receive_${email}_${provider}_tx`, '1', TIME.HALF_HOUR);
            if (isHaveTimeLock) {
                const url = this.apiConfigService.getEmailNotifyConfig.siginUrl;
                const detail = `If this recovery isn’t generated by you, please go to <a href="${url}" style="color:#8864FF">  UniPass Wallet  </a> to cancel this recovery immediately!`;
                await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                    email,
                    ctx,
                    body: MSG.EMAIL_START_RECOVERY,
                    detail,
                });
                const subTransaction = {
                    type: SubTransactionType.completedRecovery,
                    data: { email, keysetHash: newKeysetHash },
                    accountPrimaryKey: { email, provider },
                };
                const accountChainInfo = await this.queryAbiService.getAccountInfo(account.address);
                let delay = this.apiConfigService.getRecoveryConfig.completeTime * 60 * 1000;
                if (accountChainInfo === null || accountChainInfo === void 0 ? void 0 : accountChainInfo.unlockTime) {
                    delay = moment((accountChainInfo === null || accountChainInfo === void 0 ? void 0 : accountChainInfo.unlockTime) * 1000).diff(moment(), 'ms');
                }
                this.logger.log(`isHaveTimeLock delay is ${delay} from ${email}_${provider}`);
                await this.transactionQueue.add(SEND_TRANSACTION_JOB, subTransaction, {
                    delay,
                });
            }
            else {
                const url = this.apiConfigService.getEmailNotifyConfig.siginUrl;
                const detail = `Recovery has taken effect, you can log in <a href="${url}" style="color:#8864FF">  UniPass Wallet  </a> with new password now.`;
                await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                    email,
                    ctx,
                    body: MSG.EMAIL_RECOVERY_COMPLETED,
                    detail,
                });
            }
        }
    async updateCompletedRecoveryStatusData(account: any, body: any) {
            await this.queryAbiService.aggregateChainData(account.address);
            await this.accountsDBService.updateCompletedRecoveryData(account.id, account.pendingKeysetHash);
            const keyset = await this.oriHashDBService.getKeyset(account.pendingKeysetHash);
            await this.keyService.updateKeyStatus(account.id, keyset.masterKeyAddress, KeyStatus.committed);
            const url = this.apiConfigService.getEmailNotifyConfig.siginUrl;
            const detail = `Recovery has taken effect, you can log in <a href="${url}" style="color:#8864FF">  UniPass Wallet  </a> with new password now.`;
            await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                email: account.email,
                ctx: new RequestContext(),
                body,
                detail,
            });
            await this.queryAbiService.aggregateChainData(account.address);
        }
    async updateCancelRecovery(txData: any, accountPrimaryKey: any) {
            const { status } = txData;
            const { email, provider } = accountPrimaryKey;
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account) {
                this.logger.warn(`[updateCancelRecovery] account not find from = ${JSON.stringify(accountPrimaryKey)} status= ${status}`);
                return;
            }
            this.logger.log(`[updateCancelRecovery] from = ${JSON.stringify(accountPrimaryKey)} status= ${status}`);
            if (status === 0) {
                await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                    email,
                    ctx: new RequestContext(),
                    body: MSG.EMAIL_RECOVERY_FAIL,
                });
                return;
            }
            await this.updateCancelPendingKeyStatusData(account.id, account.pendingKeysetHash);
            const url = this.apiConfigService.getEmailNotifyConfig.siginUrl;
            const detail = `Account recovery has been canceled, you can log in <a href="${url}" style="color:#8864FF">  UniPass Wallet  </a> with your original password.`;
            await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                email,
                ctx: new RequestContext(),
                body: MSG.EMAIL_CANCEL_RECOVERY,
                detail,
            });
        }
    async updateCancelPendingKeyStatusData(accountId: any, keysetHash: any) {
            await this.accountsDBService.updateCancelPendingData(accountId);
            const keyset = await this.oriHashDBService.getKeyset(keysetHash);
            await this.keyService.updateKeyStatus(accountId, keyset.masterKeyAddress, KeyStatus.failed);
        }
    async completeRecovery(accountPrimaryKey: any, txData: any) {
            const { status } = txData;
            const { email, provider } = accountPrimaryKey;
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!(account === null || account === void 0 ? void 0 : account.pendingKeysetHash)) {
                return;
            }
            if (status === 0) {
                return;
            }
            await this.updateCompletedRecoveryStatusData(account, MSG.EMAIL_RECOVERY_COMPLETED);
        }
    async updateKeysetGuardian(txData: any, accountPrimaryKey: any, data: any) {
            const { isAddGuradin, newKeysetHash } = data;
            const { email, provider } = accountPrimaryKey;
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account) {
                return;
            }
            const { address } = account;
            this.logger.log(`[updateKeysetGuardian] from ${JSON.stringify(accountPrimaryKey)} status = ${txData.status}`);
            if (txData.status === 0) {
                await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                    email,
                    body: MSG.GUARDIAN_UPDATE_FAILED,
                });
            }
            const keysetData = await this.oriHashDBService.getKeyset(newKeysetHash);
            const { originEmails, keyset } = keysetData;
            this.logger.log(`[startRecovery] start recovery email originEmails = ${originEmails}`);
            const emailInfo = getKeysetEmailPepperInfo(keyset, this.logger);
            const detail = initPepperTemplate(emailInfo);
            const subject = isAddGuradin
                ? MSG.NOTIFY_ADD_GUARDIAN_SUCCESS
                : MSG.NOTIFY_DELETE_GUARDIAN_SUCCESS;
            await this.accountQueue.add(SEND_NOTIFY_EMAIL_JOB, {
                email,
                body: address,
                detail,
                subject,
                notifyType: TemplateType.accountInfo,
            });
        }
    async rollbackPendingKeysetHash(email: any, provider: any, subType: any) {
            if (subType === SubTransactionType.startRecovery ||
                subType === SubTransactionType.updateGuardian) {
                const account = await this.accountsDBService.findOneInfo(email, provider);
                if (account) {
                    await this.accountsDBService.updateCancelPendingData(account === null || account === void 0 ? void 0 : account.id);
                    this.logger.log(`[rollbackKeysetHash] keysetHash not up chain success, from ${email}_${provider},keysetHash is ${account.pendingKeysetHash}`);
                }
            }
            await this.syncAccountByUserSync(email, provider);
        }
}
