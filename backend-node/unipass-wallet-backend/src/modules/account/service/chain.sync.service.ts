import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ACCOUNT_QUEUE, SEND_SYNC_ACCOUNT_JOB, StatusName, TIME, getSyncAccountDigestMessage, getUnipassWalletContext } from '../../../shared/utils';
import moment from 'moment';
import { AccountStatus } from '../entities';
import { SyncStatus } from '../dto';
import { TransactionType } from '../../receive-email/dtos';
import { RequestContext, TemplateType } from '../../../interfaces';

@Injectable()
export class ChainSyncService {
    constructor(logger: any, accountsDBService: any, chainSyncDBService: any, oriHashDBService: any, redisService: any, jwtService: any, apiConfigService: any, queryAbiService: any, syncAccountService: any, unipassSubTransactionService: any, emailService: any, upJwtTokenService: any, @InjectQueue(ACCOUNT_QUEUE) accountQueue: any) {
        this.logger = logger;
        this.accountsDBService = accountsDBService;
        this.chainSyncDBService = chainSyncDBService;
        this.oriHashDBService = oriHashDBService;
        this.redisService = redisService;
        this.jwtService = jwtService;
        this.apiConfigService = apiConfigService;
        this.queryAbiService = queryAbiService;
        this.syncAccountService = syncAccountService;
        this.unipassSubTransactionService = unipassSubTransactionService;
        this.emailService = emailService;
        this.upJwtTokenService = upJwtTokenService;
        this.accountQueue = accountQueue;
        this.logger.setContext(ChainSyncService.name);
    }
    logger: any;
    accountsDBService: any;
    chainSyncDBService: any;
    oriHashDBService: any;
    redisService: any;
    jwtService: any;
    apiConfigService: any;
    queryAbiService: any;
    syncAccountService: any;
    unipassSubTransactionService: any;
    emailService: any;
    upJwtTokenService: any;
    accountQueue: any;
    async getStatus(getSyncStatusInput: any, account: any) {
            const { authChainNode, sendSyncEmail } = getSyncStatusInput;
            const { email, status, address, id, provider } = account;
            if (status === AccountStatus.generateKey) {
                throw new BadRequestException(StatusName.SIG_TIME_OUT);
            }
            const accountInfo = await this.getAccountInfo(account);
            account = accountInfo.account;
            const { metaNonce: genChainMetaNonce, lockDuration } = accountInfo.accountChainInfo;
            const { targetMetaNonce: authChainMetaNonce } = await this.queryAbiService.aggregateChainData(address, authChainNode);
            if (authChainMetaNonce > genChainMetaNonce) {
                this.logger.warn(`[getStatus] auth mata Nonce > gen chain meta nonce.
            authChainMetaNonce=${authChainMetaNonce},genChainMetaNonce=${genChainMetaNonce} from ${email}_${provider}`);
                throw new BadRequestException(StatusName.TARGET_META_NONCE_ERROR);
            }
            const syncStatus = await this.getSyncStatus(email, id, authChainMetaNonce, genChainMetaNonce, provider);
            if (syncStatus >= 2 && sendSyncEmail) {
                this.sendSyncEmail(email, account, authChainNode, genChainMetaNonce, lockDuration);
            }
            return {
                syncStatus,
            };
        }
    async getSyncStatus(email: any, accountId: any, authChainMetaNonce: any, genChainMetaNonce: any, provider: any) {
            let syncStatus = 0;
            if (authChainMetaNonce !== genChainMetaNonce) {
                const data = await this.chainSyncDBService.findOne({
                    accountId,
                    metaNonce: genChainMetaNonce,
                });
                syncStatus = data ? SyncStatus.ServerSynced : SyncStatus.NotSynced;
                if (syncStatus === SyncStatus.NotSynced) {
                    syncStatus = await this.getServeicSyncStatus(email, provider, genChainMetaNonce);
                }
            }
            if (authChainMetaNonce === 0 && genChainMetaNonce === 1) {
                syncStatus = 1;
            }
            return syncStatus;
        }
    async getServeicSyncStatus(email: any, provider: any, genChainMetaNonce: any) {
            const key = `sync_account_${email}_${provider}`;
            const idTokenKey = `sync_id_token_${email}_${provider}_${genChainMetaNonce}`;
            const headers = await this.redisService.getCacheData(key);
            let syncStatus = headers
                ? SyncStatus.NotReceivedDynedEmail
                : SyncStatus.NotSynced;
            if (!headers) {
                const idToken = await this.redisService.getCacheData(idTokenKey);
                syncStatus = idToken ? SyncStatus.ServerSynced : SyncStatus.NotSynced;
            }
            return syncStatus;
        }
    async getAccountInfo(account: any) {
            const accountChainInfo = await this.queryAbiService.getAccountInfo(account.address);
            if (!accountChainInfo) {
                throw new BadRequestException(StatusName.ACCOUNT_IN_PENDING);
            }
            const { isPending, pendingKeysetHash, keysetHash } = accountChainInfo;
            if (isPending && pendingKeysetHash) {
                if (account.pendingKeysetHash !== pendingKeysetHash) {
                    await this.syncAccountService.syncAccountByUserSync(account.email, account.provider);
                }
                this.logger.warn(`[getAccountInfo] account chain status is pending from ${account.email}_${account.provider}`);
                throw new BadRequestException(StatusName.ACCOUNT_IN_PENDING);
            }
            if (account.keysetHash !== keysetHash) {
                account = (await this.syncAccountService.syncAccountByUserSync(account.email, account.provider));
            }
            return { accountChainInfo, account };
        }
    async syncByOAuthIdToken(syncByOAuthIdToken: any, account: any) {
            const accountInfo = await this.getAccountInfo(account);
            account = accountInfo.account;
            const { metaNonce: genChainMetaNonce, lockDuration } = accountInfo.accountChainInfo;
            const { idToken, duration } = syncByOAuthIdToken;
            const { email, provider, address, keysetHash, sub } = account;
            const subject = this.getSubject(keysetHash, address, genChainMetaNonce, lockDuration);
            try {
                const idTokenInfo = this.jwtService.decode(idToken);
                const now = moment().valueOf() / 1000;
                if (!idTokenInfo ||
                    idTokenInfo.exp < now ||
                    idTokenInfo.nonce !== subject ||
                    idTokenInfo.sub !== sub) {
                    this.logger.warn(`[syncByOAuthIdToken] id nonce not match subject ${subject},idTokenInfo.nonce ${idTokenInfo.nonce} 
            or sub not user sub ${sub},idTokenInfo.sub=${idTokenInfo.sub} now= ${now}`);
                    throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
                }
            }
            catch (_a) {
                throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
            }
            const key = `sync_id_token_${email}_${provider}_${genChainMetaNonce}`;
            await this.redisService.saveCacheData(key, idToken, TIME.TOKEN_ID_ONE_HOUR);
            this.logger.log(`[syncByOAuthIdToken] from ${JSON.stringify({ email, provider })}`);
            const { authorization, upSignToken } = await this.upJwtTokenService.createUpSignToken(email, provider, duration, sub);
            return { authorization, upSignToken };
        }
    getSubject(keysetHash: any, address: any, genChainMetaNonce: any, lockDuringRet: any) {
            const implementationAddress = getUnipassWalletContext().moduleMainUpgradable;
            const subject = getSyncAccountDigestMessage(keysetHash, genChainMetaNonce, address, implementationAddress, lockDuringRet);
            this.logger.log(`[getSubject] subject = ${subject}，genChainMetaNonce = ${genChainMetaNonce} `);
            return subject;
        }
    async sendSyncEmail(email: any, account: any, authChainNode: any, genChainMetaNonce: any, lockDuringRet: any) {
            try {
                const implementationAddress = getUnipassWalletContext().moduleMainUpgradable;
                this.logger.log(`[sendAuthEmail] implementationAddress = ${implementationAddress} lockDuringRet = ${lockDuringRet}`);
                const key = `sync_email_${email}_${genChainMetaNonce}`;
                const data = await this.redisService.getCacheData(key);
                if (data) {
                    return;
                }
                if (account.pendingKeysetHash) {
                    account = (await this.syncAccountService.syncAccountByUserSync(email, account.provider, true));
                    if (account.pendingKeysetHash) {
                        this.logger.log(`[sendAuthEmail] account db have pendingKeysetHash pendingKeysetHash=
               ${account.pendingKeysetHash}, genChainMetaNonce = ${genChainMetaNonce}`);
                        return;
                    }
                }
                const subject = this.getSubject(account.keysetHash, account.address, genChainMetaNonce, lockDuringRet);
                this.logger.log(`[sendAuthEmail] subject = ${subject}，genChainMetaNonce = ${genChainMetaNonce} from ${email}_${account.provider}`);
                const prepareSyncAccount = {
                    email,
                    provider: account.provider,
                    address: account.address,
                    genChainMetaNonce,
                    authChainNode,
                    implementationAddress,
                    lockDuringRet,
                    keysetHash: account.keysetHash,
                    subject,
                };
                await this.accountQueue.add(SEND_SYNC_ACCOUNT_JOB, prepareSyncAccount);
                await this.redisService.saveCacheData(key, 'true', TIME.ONE_MINUTE);
            }
            catch (error) {
                this.logger.warn(`[sendAuthEmail] ${error}data=${JSON.stringify({
                    email,
                    account,
                    authChainNode,
                    genChainMetaNonce,
                })}`);
            }
        }
    async sendSyncAccountEmail(prepareSyncAccount: any) {
            const { email, subject, genChainMetaNonce, provider } = prepareSyncAccount;
            const key = `sync_account_${email}_${provider}`;
            const subjectKey = `sync_account_subject_${email}_${provider}`;
            await this.redisService.saveCacheData(key, JSON.stringify({ genChainMetaNonce }), TIME.HALF_HOUR);
            await this.redisService.saveCacheData(subjectKey, subject, TIME.HALF_HOUR);
            await this.redisService.saveCacheData(subject, JSON.stringify({
                type: TransactionType.SyncAccount,
                data: prepareSyncAccount,
            }));
            const from = this.apiConfigService.getOtpConfig.mailFrom;
            try {
                await this.emailService.createAndSendEmail(new RequestContext(), subject, TemplateType.syncAccount, subject, from, email);
            }
            catch (error) {
                this.logger.warn(`[sendSyncAccountEmail] ${error}, data = ${JSON.stringify({
                    email,
                    subject,
                })}`);
            }
        }
    async saveSyncDataInDB(data: any) {
            const { email, provider } = data;
            const account = await this.accountsDBService.findOneInfo(email, provider);
            if (!account) {
                return;
            }
            const metaNonce = await this.queryAbiService.getGenMetaNonce(account.address);
            this.logger.log(`[saveSyncDataInDB] save chain sync data = ${JSON.stringify({
                accountId: account.id,
                transactionJson: JSON.stringify(data),
                metaNonce,
            })}`);
            await this.chainSyncDBService.insertDB(account.id, JSON.stringify(data), metaNonce);
        }
    async getTransactionDatas(getTransactionInput: any, account: any) {
            const { authChainNode } = getTransactionInput;
            if (account.status === AccountStatus.generateKey) {
                throw new BadRequestException(StatusName.SIG_TIME_OUT);
            }
            const accountInfo = await this.getAccountInfo(account);
            account = accountInfo.account;
            const { metaNonce: genChainMetaNonce, lockDuration } = accountInfo.accountChainInfo;
            const { targetMetaNonce, targetKeysetHash } = await this.queryAbiService.aggregateChainData(account.address, authChainNode);
            const outputData: { transactions: any[]; isNeedDeploy: boolean; initKeysetHash: string } = {
                transactions: [],
                isNeedDeploy: false,
                initKeysetHash: '',
            };
            this.logger.log(`[getTransactionDatas] authChainMetaNonce = ${genChainMetaNonce} targetChainMetaNonce = ${targetMetaNonce}`);
            if (genChainMetaNonce === targetMetaNonce) {
                return outputData;
            }
            const txs = await this.getSyncTransaction(account, genChainMetaNonce, targetKeysetHash, lockDuration);
            this.logger.log(`[getTransactionDatas] generate tx length  = ${txs.length}`);
            if (targetMetaNonce === 0) {
                this.logger.log('[getTransactionDatas] chain.deployed = false');
                outputData.isNeedDeploy = true;
                outputData.initKeysetHash = account.initKeysetHash;
                outputData.transactions = genChainMetaNonce > 1 ? txs : [txs[0]];
            }
            else {
                this.logger.log(`[getTransactionDatas] chain.deployed = true.authChainMetaNonce = ${genChainMetaNonce},targetChainMetaNonce=${targetMetaNonce}`);
                if (genChainMetaNonce > targetMetaNonce) {
                    if (txs.length === 2) {
                        outputData.transactions = [txs[1]];
                    }
                    else {
                        this.logger.log('[getTransactionDatas] sync data not find');
                        throw new BadRequestException(StatusName.SYNC_AUTH_EMAIL_NOT_FIND);
                    }
                }
            }
            return outputData;
        }
    async getSyncTransaction(account: any, metaNonce: any, targetChainKeysetHash: any, lockDuringRet: any) {
            const transactions = [];
            const { id, initKeysetHash, address, email, provider } = account;
            const implementationAddress = getUnipassWalletContext().moduleMainUpgradable;
            const deployTx = this.unipassSubTransactionService.getDeployTransaction(initKeysetHash);
            transactions.push(deployTx);
            const data = await this.chainSyncDBService.findOne({
                accountId: id,
                metaNonce,
            });
            let zKParams;
            let idToken;
            let dkimParamsString;
            if (data) {
                const transactionJson = data.transactionJson;
                zKParams = transactionJson.zKParams;
            }
            else {
                const key = `sync_id_token_${email}_${provider}_${metaNonce}`;
                idToken = await this.redisService.getCacheData(key);
            }
            if (!zKParams && !idToken && !dkimParamsString) {
                return transactions;
            }
            const keysetHash = targetChainKeysetHash ===
                '0x0000000000000000000000000000000000000000000000000000000000000000'
                ? initKeysetHash
                : targetChainKeysetHash;
            const keyset = await this.oriHashDBService.getKeyset(keysetHash);
            this.logger.log(`[saveSyncTransactionInDB] targetChainKeysetHash=${targetChainKeysetHash} keysetHash = ${keysetHash}`);
            const syncTransaction = await this.unipassSubTransactionService.getSyncTransaction(metaNonce, address, keyset.keyset, implementationAddress, lockDuringRet, account.keysetHash, zKParams, dkimParamsString, idToken);
            if (syncTransaction) {
                transactions.push(syncTransaction);
            }
            return transactions;
        }
}
