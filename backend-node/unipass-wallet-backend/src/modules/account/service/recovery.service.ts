import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ACCOUNT_QUEUE, SEND_RECOVERY_EMAIL_JOB, SEND_TRANSACTION_JOB, StatusName, TIME, TRANSACTION_QUEUE, calculateGuardianWeight, getAccountSubject, getCancelRecoveryBuilderDigestMessage, getEmailRawDataByHashs, keysetIsPolicy, updateKeysetByMasterKey } from '../../../shared/utils';
import moment from 'moment';
import { AccountStatus, AlgType, KeyStatus } from '../entities';
import { SubTransactionType } from '../../../interfaces';

@Injectable()
export class RecoveryService {
    constructor(logger: any, redisService: any, jwtService: any, oriHashDBService: any, keyService: any, authenticatorsService: any, queryAbiService: any, @InjectQueue(ACCOUNT_QUEUE) accountQueue: any, @InjectQueue(TRANSACTION_QUEUE) transactionQueue: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.jwtService = jwtService;
        this.oriHashDBService = oriHashDBService;
        this.keyService = keyService;
        this.authenticatorsService = authenticatorsService;
        this.queryAbiService = queryAbiService;
        this.accountQueue = accountQueue;
        this.transactionQueue = transactionQueue;
        this.logger.setContext(RecoveryService.name);
    }
    logger: any;
    redisService: any;
    jwtService: any;
    oriHashDBService: any;
    keyService: any;
    authenticatorsService: any;
    queryAbiService: any;
    accountQueue: any;
    transactionQueue: any;
    async prepareStartRecovery(sendRecoveryEmailInput: any, account: any, idTokenNonce: any) {
            const { verificationEmailHash, newMasterKeyAddress } = sendRecoveryEmailInput;
            const { email, keysetHash, address, provider, id } = account;
            const oldKeyset = await this.oriHashDBService.getKeyset(keysetHash);
            await this.keyService.isRightKeyset(oldKeyset.masterKeyAddress, id);
            const { originEmails, keyset } = oldKeyset;
            const isPolicy = keysetIsPolicy(keyset, this.logger);
            const emails = getEmailRawDataByHashs([verificationEmailHash], keyset, this.logger);
            if (emails.length === 0) {
                this.logger.warn(`verificationEmailHash not find ${verificationEmailHash} in keyset raw data`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            if (!idTokenNonce && emails[0].email === email && isPolicy) {
                throw new BadRequestException(StatusName.RECOVERY_GUARDIAN_AUTH_ERROR);
            }
            if ((!idTokenNonce && emails.length === 0) ||
                !(originEmails === null || originEmails === void 0 ? void 0 : originEmails.includes(emails[0].email))) {
                throw new BadRequestException(StatusName.KEY_SET_ERROR);
            }
            const newKeyset = updateKeysetByMasterKey(newMasterKeyAddress, keyset, this.logger);
            const newKeysetHash = newKeyset.hash();
            await this.oriHashDBService.insertDB(JSON.stringify({
                keyset: newKeyset.toJson(),
                originEmails,
                masterKeyAddress: newMasterKeyAddress,
            }), AlgType.keysetHash, newKeysetHash);
            const metaNonce = await this.queryAbiService.getGenMetaNonce(address, true);
            const subject = getAccountSubject(address, newKeysetHash, metaNonce);
            this.logger.log(`[prepareStartRecovery] newKeysetHash = ${newKeysetHash} subject = ${subject}`);
            if (idTokenNonce && idTokenNonce !== subject) {
                throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
            }
            const prepareStartRecovery = {
                email,
                provider,
                address,
                newMasterKeyAddress,
                newKeysetHash,
                subject,
                verificationPepper: emails[0].pepper,
                verificationEmail: emails[0].email,
                oldKeyset,
                isHaveTimeLock: true,
                isPolicy,
            };
            await (idTokenNonce
                ? this.keyService.saveStartRecoveryData(prepareStartRecovery)
                : this.accountQueue.add(SEND_RECOVERY_EMAIL_JOB, prepareStartRecovery));
        }
    async authByOAuthIdToken(authStartRecoveryByOAuthInput: any, account: any) {
            const { idToken, verificationEmailHash, newMasterKeyAddress } = authStartRecoveryByOAuthInput;
            const { email, provider, sub } = account;
            try {
                const now = moment().valueOf() / 1000;
                const idTokenInfo = this.jwtService.decode(idToken);
                if (!idTokenInfo || idTokenInfo.exp < now || idTokenInfo.sub !== sub) {
                    this.logger.warn(`[authByOAuthIdToken] decode idTokenInfo ${JSON.stringify(idTokenInfo)},sub=${sub} now=${now}`);
                    throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
                }
                await this.prepareStartRecovery({
                    verificationEmailHash,
                    newMasterKeyAddress,
                }, account, idTokenInfo.nonce);
            }
            catch (_a) {
                throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
            }
            const key = `receive_${email}_${provider}_${email}`;
            await this.redisService.saveCacheData(key, JSON.stringify({ idToken }), TIME.TOKEN_ID_ONE_HOUR);
            this.logger.log(`[authByOAuthIdToken] from save  ${email}_${provider} idToken and start prepare start recovery `);
        }
    async startRecovery(startRecoveryInput: any, account: any) {
            const { verificationEmailHashs, auth2FaToken } = startRecoveryInput;
            const { email, provider, keysetHash, id } = account;
            const keysetData = await this.oriHashDBService.getKeyset(keysetHash);
            await this.keyService.isRightKeyset(keysetData.masterKeyAddress, id);
            const isPolicy = keysetIsPolicy(keysetData.keyset, this.logger);
            if (isPolicy) {
                await this.authenticatorsService.verify2FaAuthToken(auth2FaToken ? auth2FaToken : [], account, id, undefined, true);
            }
            this.logger.log(`[startRecovery] from ${JSON.stringify({
                email,
                provider,
            })} isPolicy ${isPolicy}`);
            const key = `recovery_subject_${email}_${provider}`;
            const subject = await this.redisService.getCacheData(key);
            this.logger.log(`[startRecovery] start recovery email subject is ${subject}, find by ${JSON.stringify({
                email,
                provider,
                key,
            })}`);
            if (!subject) {
                this.logger.log(`[startRecovery] start recovery email subject not find, find by ${JSON.stringify({
                    email,
                    provider,
                    key,
                })}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const subjectData = await this.redisService.getCacheData(subject);
            if (!subjectData) {
                this.logger.log(`[startRecovery] start recovery email subjectData not find, find by ${JSON.stringify({
                    email,
                    provider,
                })}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const { data } = JSON.parse(subjectData);
            if (!data) {
                this.logger.log(`[startRecovery] start recovery email data not find, find by ${email}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const keyset = await this.oriHashDBService.getKeyset(keysetHash);
            const { originEmails } = keyset;
            this.logger.log(`[startRecovery] start recovery email originEmails = ${originEmails}`);
            const emailInfo = getEmailRawDataByHashs(verificationEmailHashs, keyset.keyset, this.logger);
            await this.handleRecoveryEmail(originEmails, email, provider, data, keyset.keyset, emailInfo, isPolicy);
        }
    async getStartRecoveryInfoFromCache(originEmails: any, email: any, provider: any) {
            let idToken = '';
            const zkParams = [];
            const dkimParams = [];
            for (const item of originEmails) {
                const headKey = `receive_${email}_${provider}_${item}`;
                const headKeyZk = `receive_${email}_${provider}_${item}_zk`;
                const header = await this.redisService.getCacheData(headKey);
                const zkData = await this.redisService.getCacheData(headKeyZk);
                if (!header && !zkData) {
                    continue;
                }
                if (zkData) {
                    zkParams.push([item, zkData]);
                }
                if (header) {
                    if (email === item) {
                        idToken = JSON.parse(header).idToken;
                        continue;
                    }
                    dkimParams.push([item, header]);
                }
            }
            return { idToken, dkimParams, zkParams };
        }
    getGuardianRecoveryMaxZkDkimEmailList(idToken: any, isHaveTimeLock: any, dkimParams: any, zkParams: any) {
            if (!isHaveTimeLock) {
                zkParams = idToken ? zkParams.slice(0, 1) : zkParams.slice(0, 3);
                dkimParams = idToken ? dkimParams.slice(0, 1) : dkimParams.slice(0, 3);
            }
            return { zkParams, dkimParams };
        }
    async handleRecoveryEmail(originEmails: any, email: any, provider: any, data: any, keyset: any, emailInfo: any, isPolicy: any) {
            const { idToken, dkimParams, zkParams } = await this.getStartRecoveryInfoFromCache(originEmails, email, provider);
            const verificationEmail = emailInfo.map((item: any) => item.email);
            const sendRecoveryAction = calculateGuardianWeight(keyset, zkParams, dkimParams, verificationEmail, this.logger, isPolicy, idToken);
            this.logger.log(`[handleRecoveryEmail] sendRecoveryAction = ${JSON.stringify(sendRecoveryAction)}`);
            if (!sendRecoveryAction.canSendStartRecoveryTx) {
                return;
            }
            const maxZkDkimData = this.getGuardianRecoveryMaxZkDkimEmailList(idToken, sendRecoveryAction.isHaveTimeLock, dkimParams, zkParams);
            data.isHaveTimeLock = sendRecoveryAction.isHaveTimeLock;
            data.zkParams = maxZkDkimData.zkParams;
            data.emailHeaderParams = maxZkDkimData.dkimParams;
            data.isPolicy = isPolicy;
            data.idToken = idToken;
            const subTransaction = {
                type: SubTransactionType.startRecovery,
                data,
                accountPrimaryKey: { email, provider },
            };
            await this.transactionQueue.add(SEND_TRANSACTION_JOB, subTransaction);
        }
    async getReceiveRecoveryEmailStatus(account: any) {
            const { email, provider, keysetHash } = account;
            const keyset = await this.oriHashDBService.getKeyset(keysetHash);
            const status = await this.keyService.getRecoveryEmailStatus(keyset.keyset, email, provider);
            this.logger.log(`[getReceiveRecoveryEmailStatus] accountPrimaryKey=${JSON.stringify({
                email,
                provider,
                status,
            })}`);
            return status;
        }
    async cancelRecovery(cancelRecoveryInput: any, ctx: any) {
            const { user: account } = ctx;
            const { transaction, metaNonce, signature } = cancelRecoveryInput;
            if (!transaction.data || !transaction.target) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const { email, address, provider, keysetHash, id } = account;
            const keyset = await this.oriHashDBService.getKeyset(keysetHash);
            await this.keyService.isRightKeyset(keyset.masterKeyAddress, id);
            await this.verifyCancelRecoveryData(address, metaNonce, signature);
            const cancelRecovery = { email, transaction };
            const subTransaction = {
                type: SubTransactionType.cancelRecovery,
                data: cancelRecovery,
                accountPrimaryKey: { email, provider },
            };
            await this.transactionQueue.add(SEND_TRANSACTION_JOB, subTransaction);
        }
    async verifyCancelRecoveryData(address: any, nonce: any, signature: any) {
            const { isPending } = await this.queryAbiService.getLockInfo(address);
            if (!isPending) {
                throw new BadRequestException(StatusName.ACCOUNT_NOT_IN_RECOVERY);
            }
            const metaNonce = await this.queryAbiService.getGenMetaNonce(address, true);
            if (metaNonce !== nonce) {
                throw new BadRequestException(StatusName.META_NOCER_ERROR);
            }
            const sigDigestMessage = getCancelRecoveryBuilderDigestMessage(address, metaNonce);
            const isVerified = await this.queryAbiService.isValidSignature(address, signature, sigDigestMessage);
            if (!isVerified) {
                throw new BadRequestException(StatusName.CLOUD_KEY_SIG_ERROR);
            }
        }
    async uploadMaterKeyForRecovery(uploadRecoveryMasterKeyInput: any, account: any) {
            let { masterKey } = uploadRecoveryMasterKeyInput;
            masterKey = this.keyService.checkMasterKey(masterKey);
            const { email, provider, keysetHash, id, status } = account;
            if (status === AccountStatus.pending) {
                throw new BadRequestException(StatusName.ACCOUNT_IN_PENDING);
            }
            const keyset = await this.oriHashDBService.getKeyset(keysetHash);
            await this.keyService.saveMasterKey(id, masterKey, KeyStatus.recoveryPending);
            this.logger.log(`[uploadMaterKeyForRecovery] originEmails = ${keyset.originEmails}`);
            await this.redisService.deleteCacheData(`receive_${email}_${provider}_tx`);
            await this.redisService.deleteCacheData(`start_recovery_${email}_${provider}`);
            for (const item of keyset.originEmails) {
                await this.redisService.deleteCacheData(`receive_${email}_${provider}_${item}`);
                await this.redisService.deleteCacheData(item);
            }
        }
}
