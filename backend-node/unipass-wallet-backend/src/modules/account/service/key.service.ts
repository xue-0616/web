import { BadRequestException, Injectable } from '@nestjs/common';
import { KeyStatus } from '../entities';
import { StatusName, TIME, getKeyEmailInfo, verifyK1Sign } from '../../../shared/utils';
import { TransactionType } from '../../receive-email/dtos';
import { KeyType, RequestContext, TemplateType } from '../../../interfaces';
import { Keyset } from '@unipasswallet/keys';
import { EmailStatus } from '../dto';
import { getBytes } from 'ethers';
import { initSignMessasg } from '../../../shared/utils/snap.utils';

@Injectable()
export class KeyService {
    constructor(logger: any, keyDBService: any, redisService: any, apiConfigService: any, emailService: any) {
        this.logger = logger;
        this.keyDBService = keyDBService;
        this.redisService = redisService;
        this.apiConfigService = apiConfigService;
        this.emailService = emailService;
        this.logger.setContext(KeyService.name);
    }
    logger: any;
    keyDBService: any;
    redisService: any;
    apiConfigService: any;
    emailService: any;
    async saveMasterKey(accountId: any, masterKey: any, status: any = KeyStatus.pending, web3AuthAddress: any) {
            const { keyStore, masterKeyAddress, keyType } = masterKey;
            await this.keyDBService.insertDB(accountId, keyStore ? keyStore : '', masterKeyAddress, status, undefined, keyType, web3AuthAddress);
        }
    async saveTssLocalKey(accountId: any, masterKey: any, status: any = KeyStatus.pending) {
            const { keyStore, masterKeyAddress } = masterKey;
            const key = await this.keyDBService.findOne({
                address: masterKeyAddress,
                accountId,
            });
            if (!key) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            await this.keyDBService.updateDB(key.id, {
                address: masterKeyAddress,
                keystore: keyStore,
                status,
            });
        }
    async saveStartRecoveryData(sendRecoveryEmailInput: any) {
            const { email, newKeysetHash, subject, provider, verificationPepper, verificationEmail, } = sendRecoveryEmailInput;
            const keyPeeper = `${verificationEmail}`;
            const key = `recovery_${email}_${provider}`;
            const subjectKey = `recovery_subject_${email}_${provider}`;
            await this.redisService.saveCacheData(key, JSON.stringify({ keysetHash: newKeysetHash }), TIME.HALF_HOUR);
            await this.redisService.saveCacheData(subjectKey, subject, TIME.HALF_HOUR);
            await this.redisService.saveCacheData(subject, JSON.stringify({
                type: TransactionType.StartRecovery,
                data: sendRecoveryEmailInput,
            }));
            await this.redisService.saveCacheData(keyPeeper, verificationPepper, TIME.HALF_HOUR);
        }
    async sendRecoveryEmail(sendRecoveryEmailInput: any) {
            const { verificationEmail, subject, isPolicy, email } = sendRecoveryEmailInput;
            const from = this.apiConfigService.getOtpConfig.mailFrom;
            await this.saveStartRecoveryData(sendRecoveryEmailInput);
            try {
                await this.emailService.createAndSendEmail(new RequestContext(), subject, isPolicy
                    ? TemplateType.policyRecoveryEmail
                    : TemplateType.guardianRecoveryEmail, subject, from, verificationEmail, email);
            }
            catch (error) {
                this.logger.warn(`[sendRecoveryEmail] ${error},data= ${JSON.stringify({
                    verificationEmail,
                    subject,
                    isPolicy,
                })}`);
            }
        }
    async getRecoveryEmailStatus(keysetJson: any, email: any, provider: any) {
            const receiveList = [];
            const txStatus = await this.redisService.getCacheData(`receive_${email}_${provider}_tx`);
            const keyset = Keyset.fromJson(keysetJson);
            const hashKey = `start_recovery_${email}_${provider}`;
            const transactionHash = (await this.redisService.getCacheData(hashKey)) || '';
            for (const item of keyset.keys) {
                const { emailFrom, emailHash } = getKeyEmailInfo(item);
                if (!emailFrom) {
                    continue;
                }
                const key = `receive_${email}_${provider}_${emailFrom}`;
                const data = await this.redisService.getCacheData(key);
                let status = data ? EmailStatus.receive : EmailStatus.pending;
                if (!txStatus) {
                    status = data ? EmailStatus.receive : EmailStatus.pending;
                }
                if (txStatus === '1') {
                    status = EmailStatus.committed;
                }
                receiveList.push({
                    emailHash,
                    status,
                    transactionHash,
                });
            }
            return receiveList;
        }
    async updateKeyStatus(accountId: any, masterKeyAddress: any, status: any) {
            const key = await this.keyDBService.findOne({
                accountId,
                address: masterKeyAddress,
            });
            if (!key) {
                return;
            }
            if (status === KeyStatus.committed) {
                const oldKey = await this.keyDBService.findOne({
                    accountId,
                    status: KeyStatus.committed,
                });
                if (oldKey && oldKey.id !== key.id) {
                    await this.keyDBService.updateDB(oldKey.id, {
                        status: KeyStatus.failed,
                    });
                }
            }
            await this.keyDBService.updateDB(key.id, { status, updatedAt: new Date() });
        }
    async getKeystore(accountId: any, address: any) {
            const key = await this.keyDBService.findOne({
                accountId,
                address,
            });
            if (!key) {
                this.logger.warn(`key not find ${accountId},address=${address}`);
                throw new BadRequestException(StatusName.EMAIL_NOT_EXISTS);
            }
            return {
                keystore: key.keystore.toString(),
                keyType: key.keyType,
                web3authAddress: key.web3AuthAddress,
            };
        }
    verifyMasterSig(digestHash: any, sig: any, materKeyAddress: any, errorName: any = StatusName.PERMIT_AUTH_SIG_ERROR) {
            this.logger.log(`[verifyMasterSig] digestHash = ${digestHash} sig = ${sig}`);
            let isVerified = false;
            try {
                isVerified = verifyK1Sign(getBytes(digestHash), sig.slice(0, 132), materKeyAddress);
            }
            catch (error) {
                this.logger.warn(`verifyMasterSig error ${error}`);
                throw new BadRequestException(errorName);
            }
            this.logger.log(`[verifyMasterSig] isVerified = ${isVerified}`);
            if (!isVerified) {
                throw new BadRequestException(errorName);
            }
        }
    checkMasterKey(masterKey: any) {
            let { keyType } = masterKey;
            const { masterKeyAddress, keyStore, keySig } = masterKey;
            keyType = !keyType ? KeyType.MPC : Number(keyType);
            const keyTypes = [
                KeyType.MPC,
                KeyType.AWS_KMS,
                KeyType.WEB3_AUTH,
                KeyType.CUSTOM_AUTH,
            ];
            if (keyTypes.includes(keyType) &&
                (!masterKeyAddress.trim() || !keyStore || !keyStore.trim())) {
                this.logger.warn('[checkMasterKey] !masterKeyAddress.trim() || !keyStore || !keyStore.trim()');
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            else if (!keyTypes.includes(keyType) && keyType === KeyType.SNAP) {
                if (!keySig || !masterKeyAddress.trim()) {
                    this.logger.warn('[checkMasterKey] !keySig || !masterKeyAddress.trim()');
                    throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
                }
                this.verifyMasterKey(keySig, masterKeyAddress);
            }
            if (!keyStore) {
                masterKey.keyStore = '';
            }
            masterKey.keyType = keyType;
            return masterKey;
        }
    verifyMasterKey(keySig: any, masterKeyAddress: any) {
            const { sig, message } = keySig;
            if (!sig || !message) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            try {
                const rawMessage = initSignMessasg(message);
                if (!rawMessage) {
                    throw new BadRequestException(StatusName.CLOUD_KEY_SIG_ERROR);
                }
                const isVerify = verifyK1Sign(rawMessage, sig, masterKeyAddress);
                if (!isVerify) {
                    throw new BadRequestException(StatusName.CLOUD_KEY_SIG_ERROR);
                }
            }
            catch (error) {
                this.logger.warn(`[verifyMasterKey] error ${error} data = ${JSON.stringify({
                    sig,
                    message,
                    masterKeyAddress,
                })}`);
                throw new BadRequestException(StatusName.CLOUD_KEY_SIG_ERROR);
            }
        }
    async isRightKeyset(masterKeyAddress: any, id: any) {
            const { keyType } = await this.getKeystore(id, masterKeyAddress);
            if (keyType === KeyType.AWS_KMS) {
                this.logger.warn(`[isRightKeyset] keyset type no right master key address = ${masterKeyAddress}`);
                throw new BadRequestException(StatusName.KEYSET_ERROR);
            }
        }
}
