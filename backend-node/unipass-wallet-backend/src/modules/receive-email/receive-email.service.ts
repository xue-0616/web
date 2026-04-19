import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { MSG, SEND_ZK_REQUEST_PROOF_JOB, TIME, ZK_QUEUE, getEmailBuriedName, getEmailDkimInfo } from '../../shared/utils';
import { hexlify, randomBytes } from 'ethers';
import { RequestContext } from '../../interfaces';
import { DkimParamsBase } from '@unipasswallet/dkim';
import { TransactionType } from './dtos';

@Injectable()
export class ReceiveEmailService {
    constructor(logger: any, apiConfigService: any, emailService: any, redisService: any, chainSyncService: any, queryAbiService: any, @InjectQueue(ZK_QUEUE) zkQueue: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.emailService = emailService;
        this.redisService = redisService;
        this.chainSyncService = chainSyncService;
        this.queryAbiService = queryAbiService;
        this.zkQueue = zkQueue;
        this.logger.setContext(ReceiveEmailService.name);
    }
    logger: any;
    apiConfigService: any;
    emailService: any;
    redisService: any;
    chainSyncService: any;
    queryAbiService: any;
    zkQueue: any;
    async receiveUserEmail(originEmails: any) {
            const { subject, fromAddress, headers } = await getEmailDkimInfo(originEmails, this.logger);
            if (!fromAddress || !headers) {
                this.logger.log('[parseEmail] fromAddress or headers not find');
                return false;
            }
            let pepper = await this.redisService.getCacheData(fromAddress);
            if (!pepper) {
                pepper = hexlify(randomBytes(32));
            }
            const isDkimVerify = await this.dkimVerify({ subject, fromAddress, headers }, pepper);
            if (!isDkimVerify) {
                return;
            }
            const zkInfo = {
                emailHeader: headers.hexEmailHeader,
                fromPepper: pepper,
            };
            await this.zkQueue.add(SEND_ZK_REQUEST_PROOF_JOB, {
                zkInfo,
                time: 0,
                emailData: { subject, fromAddress, headers: headers.toString() },
            });
        }
    async dkimVerify(emailData: any, fromPepper: any, isDkimVerify: any = false) {
            const { fromAddress, headers } = emailData;
            const ctx = new RequestContext();
            if (!isDkimVerify) {
                const ret = await this.queryAbiService.dkimVerify(headers, fromAddress, fromPepper);
                isDkimVerify = ret[0];
            }
            if (!isDkimVerify) {
                this.logger.log(`buried point event = ${getEmailBuriedName.emailDkimParamsParsingError}, data = ${headers}, fromEmail=${fromAddress}`);
                await this.emailService.sendEmailNotify(ctx, MSG.EMAIL_DKIM_FAIL, fromAddress);
            }
            return isDkimVerify;
        }
    async processEmail(ctx: any, emailInfo: any, zkData: any) {
            const { subject, fromAddress } = emailInfo;
            let headers;
            if (typeof emailInfo.headers === 'string') {
                headers = DkimParamsBase.fromString(emailInfo.headers);
            }
            if (!fromAddress) {
                return;
            }
            let temp = '';
            try {
                temp = await this.getIntentByEmailSubject(subject, emailInfo);
            }
            catch (error) {
                const e = error as Error;
                this.logger.error(`[processEmail] ReceiveEmailService error =:${e},${e?.stack}`);
                const errorMessage = e.message;
                if (![MSG.EMAIL_SUBJECT_ERROR, MSG.EMAIL_SUBJECT_NOT_FIND].includes(errorMessage)) {
                    await this.emailService.sendEmailNotify(ctx, errorMessage, fromAddress);
                }
                return;
            }
            const { type, data } = JSON.parse(temp);
            switch (type) {
                case TransactionType.StartRecovery:
                    await this.handleRecoveryEmail(data, fromAddress, zkData, headers);
                    break;
                case TransactionType.SyncAccount:
                    await this.handleSyncAccountEmail(data, fromAddress, zkData, headers);
                    break;
            }
        }
    async getIntentByEmailSubject(subject: any, emailInfo: any) {
            const mailSubjectPrefix = this.apiConfigService.getOtpConfig.subjectPrefix;
            try {
                const subjectList = subject.split(mailSubjectPrefix);
                subject = subjectList[subjectList.length - 1];
            }
            catch (error) {
                const e = error as Error;
                this.logger.warn(`[getIntentByEmailSubject]  ${e.message}, data=${JSON.stringify({
                    subject,
                })}`);
                this.logger.log(`buried point event = ${getEmailBuriedName.subjectNotFind}, data = ${JSON.stringify(emailInfo)}, subject=${subject}`);
                throw new Error(MSG.EMAIL_SUBJECT_ERROR);
            }
            const temp = await this.redisService.getCacheData(subject);
            this.logger.log(`[getIntentByEmailSubject] ReceiveEmailService key=> ${subject} temp data is=>${temp}`);
            if (!temp) {
                this.logger.log(`buried point event = ${getEmailBuriedName.subjectNotFind}, data = ${JSON.stringify(emailInfo)}, subject=${subject}`);
                throw new Error(MSG.EMAIL_SUBJECT_NOT_FIND);
            }
            return temp;
        }
    async handleRecoveryEmail(data: any, fromAddress: any, zKParams: any, emailHeaderParams: any) {
            const { email, newKeysetHash, oldKeyset, isPolicy, subject, provider } = data;
            const key = `recovery_${email}_${provider}`;
            const subjectKey = `recovery_subject_${email}_${provider}`;
            const latestSubject = await this.redisService.getCacheData(subjectKey);
            if (latestSubject !== subject) {
                this.logger.log(`buried point event = ${getEmailBuriedName.recoverySubjectNotMatchEmail}, data = ${JSON.stringify(data)}, email=${email}_${provider}, latestSubject =${latestSubject}`);
                return;
            }
            const latestKeysetHash = await this.redisService.getCacheData(key);
            this.logger.log(`[handleRecoveryEmail]:latestKeysetHash=${latestKeysetHash}, key = ${key} `);
            if (!latestKeysetHash) {
                this.logger.log(`buried point event = ${getEmailBuriedName.recoveryKeysetHashNotFind}, data = ${JSON.stringify(data)}, email=${email}_${provider}, emailFrom =${fromAddress}`);
                return;
            }
            const latestKeysetHashData = JSON.parse(latestKeysetHash);
            this.logger.log(`[handleRecoveryEmail]:latestKeysetHash=${latestKeysetHashData.keysetHash}, key = ${latestKeysetHash} `);
            if (latestKeysetHashData.keysetHash !== newKeysetHash) {
                this.logger.log(`buried point event = ${getEmailBuriedName.recoveryKeysetHashNotMatch}, data = ${JSON.stringify(data)}, email=${email}_${provider}, emailFrom =${fromAddress}`);
                return;
            }
            const { originEmails } = oldKeyset;
            if (!(originEmails === null || originEmails === void 0 ? void 0 : originEmails.includes(fromAddress))) {
                this.logger.log(`buried point event = ${getEmailBuriedName.recoveryEmailNotMatch}, data = ${JSON.stringify(data)}, email=${email}_${provider}, guardianList=${originEmails},emailFrom =${fromAddress}`);
                return;
            }
            const receiveKeyZk = `receive_${email}_${provider}_${fromAddress}_zk`;
            await this.redisService.saveCacheData(receiveKeyZk, JSON.stringify(zKParams), TIME.HALF_HOUR);
            const receiveKeyDkim = `receive_${email}_${provider}_${fromAddress}`;
            await this.redisService.saveCacheData(receiveKeyDkim, emailHeaderParams.toString(), TIME.HALF_HOUR);
            const evenName = isPolicy
                ? getEmailBuriedName.policyRecoveryEmailSuccess
                : getEmailBuriedName.guardianRecoveryEmailSuccess;
            this.logger.log(`buried point event = ${evenName}, data = ${JSON.stringify(data)}, email=${email}_${provider}, emailFrom =${fromAddress}`);
        }
    async handleSyncAccountEmail(data: any, fromAddress: any, zKParams: any, dkimParamsString: any) {
            const { email, genChainMetaNonce, subject, provider } = data;
            if (fromAddress !== email) {
                this.logger.log(`buried point event = ${getEmailBuriedName.syncEmailNotMatch}, data = ${JSON.stringify(data)}, email=${email}_${provider}, emailFrom =${fromAddress}`);
                return;
            }
            const subjectKey = `sync_account_subject_${email}_${provider}`;
            const subjectData = await this.redisService.getCacheData(subjectKey);
            if (subjectData !== subject) {
                this.logger.log(`buried point event = ${getEmailBuriedName.syncSubjectNotMatch}, data = ${JSON.stringify(data)}, email=${email}_${provider}, latestSubject =${subjectData}`);
                return;
            }
            const key = `sync_account_${email}_${provider}`;
            const metaNonce = await this.redisService.getCacheData(key);
            this.logger.log(`[handleSyncAccountEmail]:metaNonce=${metaNonce}, key = ${key} `);
            if (!metaNonce) {
                this.logger.log(`buried point event = ${getEmailBuriedName.syncMetaNonceNotFind}, data = ${JSON.stringify(data)}, email=${email}_${provider}, metaNonce =${metaNonce}`);
                return;
            }
            const metaNonceData = JSON.parse(metaNonce);
            this.logger.log(`[handleSyncAccountEmail]:metaNonceData.genChainMetaNonce=${metaNonceData.genChainMetaNonce}, genChainMetaNonce = ${genChainMetaNonce} `);
            if (metaNonceData.genChainMetaNonce !== genChainMetaNonce) {
                this.logger.log(`buried point event = ${getEmailBuriedName.syncMetaNonceNotMatch}, data = ${JSON.stringify(data)}, email=${email}_${provider}, genChainMetaNonce =${genChainMetaNonce}`);
                return;
            }
            data.zKParams = zKParams.toString();
            data.dkimParamsString = dkimParamsString.toString();
            await this.chainSyncService.saveSyncDataInDB(data);
            const receiveKey = `sync_receive_${email}_${provider}`;
            await this.redisService.saveCacheData(receiveKey, JSON.stringify(zKParams), TIME.HALF_HOUR);
            this.logger.log(`buried point event = ${getEmailBuriedName.syncEmailSuccess}, data = ${JSON.stringify(data)}, email=${email}_${provider}`);
        }
}
