import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { SEND_TRANSACTION_JOB, StatusName, TIME, TRANSACTION_QUEUE, checkGuardIsRepeated, getKeysetData, getUpdateGuardinKeyset, getUpdateKeysetHashTxBuilderMessage, hideSecurityInformation, isOnlyChangeGuardian, sha256Hash } from '../../../shared/utils';
import { AccountStatus, AlgType, AuthType, ProviderType } from '../entities';
import { OtpAction } from '../../otp/dtos';
import { ZeroAddress } from 'ethers';
import { KeyType, SubTransactionType } from '../../../interfaces';

@Injectable()
export class AccountsService {
    constructor(logger: any, accountsDBService: any, oriHashDBService: any, keyService: any, redisService: any, otpCodeBaseService: any, authenticatorsDBService: any, queryAbiService: any, upJwtTokenService: any, syncAccountService: any, apiConfigService: any, @InjectQueue(TRANSACTION_QUEUE) transactionQueue: any) {
        this.logger = logger;
        this.accountsDBService = accountsDBService;
        this.oriHashDBService = oriHashDBService;
        this.keyService = keyService;
        this.redisService = redisService;
        this.otpCodeBaseService = otpCodeBaseService;
        this.authenticatorsDBService = authenticatorsDBService;
        this.queryAbiService = queryAbiService;
        this.upJwtTokenService = upJwtTokenService;
        this.syncAccountService = syncAccountService;
        this.apiConfigService = apiConfigService;
        this.transactionQueue = transactionQueue;
        this.logger.setContext(AccountsService.name);
    }
    logger: any;
    accountsDBService: any;
    oriHashDBService: any;
    keyService: any;
    redisService: any;
    otpCodeBaseService: any;
    authenticatorsDBService: any;
    queryAbiService: any;
    upJwtTokenService: any;
    syncAccountService: any;
    apiConfigService: any;
    transactionQueue: any;
    async verifySignUpData(account: any, originEmails: any) {
            if (account.status !== AccountStatus.generateKey) {
                this.logger.warn(`[verifySignUpData] account status not generateKey account.status =${account.status}`);
                throw new BadRequestException(StatusName.ACCOUNT_EXISTS);
            }
            const { email, provider } = account;
            for (const item of originEmails) {
                const token = await this.otpCodeBaseService.getUpAuthToken(OtpAction.SendGuardian, item, `${email}_${provider}`);
                this.logger.log(`[verifySignUpData] OtpBaseService: token = ${token} `);
                if (!token) {
                    this.logger.warn('[verifySignUpData] guardian token not find');
                    throw new BadRequestException(StatusName.GUARDIAN_VERIFY_ERROR);
                }
                await this.otpCodeBaseService.verifyUpAuthToken(token, OtpAction.SendGuardian, `${item}_${provider}`, false, `${email}_${provider}`);
            }
        }
    async saveSignUpDataInDB(signUpAccountInput: any, address: any, keyset: any, originEmails: any, account: any, source: any) {
            const { email, id } = account;
            const { masterKey, pepper } = signUpAccountInput;
            await this.oriHashDBService.insertDB(JSON.stringify({
                keyset: keyset.toJson(),
                originEmails,
                masterKeyAddress: masterKey.masterKeyAddress,
            }), AlgType.keysetHash, keyset.hash());
            await this.oriHashDBService.insertDB(JSON.stringify({ email, pepper }), AlgType.sha256, sha256Hash(email, pepper ? pepper : '0x0'));
            await this.accountsDBService.updateDB(id, {
                address,
                status: AccountStatus.pending,
                pepper,
                source,
                updatedAt: new Date(),
            });
            await this.authenticatorsDBService.insertDB(id, JSON.stringify({ email }), AuthType.Email);
            await this.keyService.saveMasterKey(id, masterKey);
        }
    async lockSingUpByRedis(account: any) {
            const { email, provider } = account;
            const key = `sign_up:${email}`;
            const providerInfo = await this.redisService.getCacheData(key);
            let providers = [provider.toString()];
            this.logger.log(`[lockSingUpByRedis] from ${JSON.stringify({
                email,
                provider,
            })} providerInfo = ${providerInfo}`);
            if (providerInfo) {
                providers = providerInfo.split(',');
                if (providers.includes(provider.toString())) {
                    throw new BadRequestException(StatusName.ACCOUNT_IN_PENDING);
                }
                else if (provider !== ProviderType.auth0_apple) {
                    throw new BadRequestException(StatusName.ACCOUNT_IN_PENDING);
                }
                else {
                    providers.push(provider.toString());
                }
            }
            await this.redisService.saveCacheData(key, providers.join(','), TIME.ONE_MINUTE);
            this.logger.log(`[lockSingUpByRedis] from ${JSON.stringify({
                email,
                provider,
            })} save lock info ${providers}`);
        }
    async signUp(signUpAccountInput: any, account: any) {
            const { email, provider, sub } = account;
            await this.lockSingUpByRedis(account);
            this.logger.log(`[signUp] AccountsService from ${JSON.stringify({
                email,
                provider,
            })} input = ${JSON.stringify(signUpAccountInput)} `);
            const { keysetJson, source } = signUpAccountInput;
            const { masterKey } = signUpAccountInput;
            const masterKeyData = this.keyService.checkMasterKey(masterKey);
            signUpAccountInput.masterKey = masterKeyData;
            const { keyType } = masterKeyData;
            const keysetData = getKeysetData(keysetJson, this.logger, email, keyType);
            const { originEmails, keyset } = keysetData;
            if (originEmails.includes(email) && keyType !== KeyType.AWS_KMS) {
                throw new BadRequestException(StatusName.GUARDIAN_VERIFY_ERROR);
            }
            const keysetHash = keyset.hash();
            signUpAccountInput.keysetHash = keysetHash;
            const address = await this.queryAbiService.getContractAddressAndCheckRegistration(keysetJson);
            await this.verifySignUpData(account, originEmails);
            originEmails.unshift(email);
            await this.saveSignUpDataInDB(signUpAccountInput, address, keyset, originEmails, account, source);
            const subTransaction = {
                type: SubTransactionType.signUp,
                data: signUpAccountInput,
                accountPrimaryKey: { email, provider },
            };
            await this.transactionQueue.add(SEND_TRANSACTION_JOB, subTransaction);
            const upJwtToken = await this.upJwtTokenService.createUpSignToken(email, provider, TIME.MINUTES_OF_DAY, sub);
            return {
                address,
                keysetHash,
                authorization: upJwtToken.authorization,
                upSignToken: upJwtToken.upSignToken,
            };
        }
    async snapSignCheck(masterKey: any, account: any) {
            const { masterKeyAddress } = await this.oriHashDBService.getKeyset(account.status === AccountStatus.pending
                ? account.initKeysetHash
                : account.keysetHash);
            let isVerify = false;
            const isMatch = masterKeyAddress.toLocaleLowerCase() ===
                masterKey.masterKeyAddress.toLocaleLowerCase();
            this.logger.log(`snapSignCheck : keyset masterKey ${masterKeyAddress},snap master key :${masterKey.masterKeyAddress} isMatch = ${isMatch}`);
            if (isMatch) {
                try {
                    this.keyService.checkMasterKey(masterKey);
                    isVerify = true;
                }
                catch (error) {
                    this.logger.warn(`[snapSignCheck]  ${error}`);
                    isVerify = false;
                }
            }
            return {
                isVerify,
            };
        }
    async updateLoginTimeRecord(key: any, record: any) {
            record.count += 1;
            await this.redisService.saveCacheData(key, JSON.stringify(record), TIME.DAY);
            return record;
        }
    async getAccountKeyset(account: any) {
            if (account.status <= AccountStatus.pending) {
                throw new BadRequestException(StatusName.SIG_TIME_OUT);
            }
            const keyset = await this.oriHashDBService.getKeyset(account.keysetHash);
            hideSecurityInformation(keyset, this.logger);
            const data = Object.assign(Object.assign({}, keyset), { accountAddress: account.address });
            delete data.originEmails;
            return data;
        }
    async checkKeyset(checkKeysetInput: any, account: any) {
            const { keysetJson, isAddGuradian } = checkKeysetInput;
            account = (await this.syncAccountService.syncAccountByUserSync(account.email, account.provider));
            const { email, keysetHash, provider, pendingKeysetHash, status, id } = account;
            if (pendingKeysetHash || status === AccountStatus.pending) {
                throw new BadRequestException(StatusName.ACCOUNT_IN_PENDING);
            }
            const key = `update_guardian_${email}_${provider}`;
            await this.redisService.deleteCacheData(key);
            await this.redisService.deleteCacheData(`update_guardian_tx_${email}_${provider}`);
            const oldKeyset = await this.oriHashDBService.getKeyset(keysetHash);
            await this.keyService.isRightKeyset(oldKeyset.masterKeyAddress, id);
            const canSaveKeysetInRedis = isOnlyChangeGuardian(oldKeyset.keyset, keysetJson, this.logger);
            if (!canSaveKeysetInRedis) {
                throw new BadRequestException(StatusName.KEYSET_ERROR);
            }
            const keyset = getUpdateGuardinKeyset(keysetJson, oldKeyset.keyset, isAddGuradian, this.logger);
            const isGuardianRepeated = checkGuardIsRepeated(keyset.toJson(), this.logger);
            if (isGuardianRepeated) {
                throw new BadRequestException(StatusName.KEYSET_GUARDIAN_ADDED);
            }
            const newKeysetHash = keyset.hash();
            this.logger.log(`[chanKeyset] from ${JSON.stringify({
                email,
                provider,
            })} newKeysetHash = ${newKeysetHash}, newKeysetJson = ${keyset.toJson()}, oldKeysetJson = ${oldKeyset.keyset}`);
            await this.redisService.saveCacheData(key, JSON.stringify({ isAddGuradian, keysetJson: keyset.toJson() }), TIME.HALF_HOUR);
            return { newKeysetHash };
        }
    async updateGuardian(updateGuardianInput: any, account: any) {
            const { masterKeySig } = updateGuardianInput;
            const { email, keysetHash, address, provider, id } = account;
            this.logger.log(`[updateGuardian] from ${JSON.stringify({
                email,
                provider,
            })} masterKeySig = ${masterKeySig} keysetHash = ${keysetHash}`);
            const oldKeyset = await this.oriHashDBService.getKeyset(keysetHash);
            await this.keyService.isRightKeyset(oldKeyset.masterKeyAddress, id);
            const keysetInfo = await this.redisService.getCacheData(`update_guardian_${email}_${provider}`);
            if (!keysetInfo) {
                throw new BadRequestException(StatusName.KEYSET_ERROR);
            }
            const { keysetJson, isAddGuradian } = JSON.parse(keysetInfo);
            const keysetData = getKeysetData(keysetJson, this.logger);
            this.logger.log(`[updateGuardian] new Keyset = ${keysetJson}`);
            const metaNonce = await this.queryAbiService.getGenMetaNonce(address, true);
            this.verifyUpdateGuardian(address, metaNonce, oldKeyset.masterKeyAddress, keysetData.keyset.hash(), masterKeySig);
            const { originEmails, keyset } = keysetData;
            if (!originEmails.includes(email)) {
                originEmails.unshift(email);
            }
            await this.oriHashDBService.insertDB(JSON.stringify({
                keyset: keysetJson,
                originEmails,
                masterKeyAddress: oldKeyset.masterKeyAddress,
            }), AlgType.keysetHash, keyset.hash());
            const updateKeysetGuardian = {
                address,
                masterKeyAddress: oldKeyset.masterKeyAddress,
                newKeysetHash: keyset.hash(),
                oldKeyset,
                masterKeySig,
                isAddGuradin: isAddGuradian,
            };
            const subTransaction = {
                type: SubTransactionType.updateGuardian,
                data: updateKeysetGuardian,
                accountPrimaryKey: { email, provider },
            };
            await this.transactionQueue.add(SEND_TRANSACTION_JOB, subTransaction);
        }
    async updateAccountChainSyncStatus(account: any) {
            const { email, provider } = account;
            await this.syncAccountService.syncAccountByUserSync(email, provider, true, 10);
        }
    verifyUpdateGuardian(accountAddress: any, metaNonce: any, masterKeyAddress: any, newKeysetHash: any, signature: any) {
            const sigDigestMessage = getUpdateKeysetHashTxBuilderMessage(accountAddress, metaNonce, newKeysetHash);
            this.logger.log(`[verifyUpdateGuardian] verifyMasterSig = ${JSON.stringify({
                sigDigestMessage,
                signature,
                masterKeyAddress,
                accountAddress,
                metaNonce,
                newKeysetHash,
            })}`);
            this.keyService.verifyMasterSig(sigDigestMessage, signature, masterKeyAddress);
        }
    async getEmailProviderCheck(emailProviderCheckInput: any, provider: any = ProviderType.auth0_email) {
            if (provider === ProviderType.auth0_apple) {
                return { provider };
            }
            this.logger.log(`[getEmailProviderCheck] input ${JSON.stringify(emailProviderCheckInput)},provider = ${provider}`);
            emailProviderCheckInput.source = emailProviderCheckInput.source
                ? emailProviderCheckInput.source
                : 'unipass';
            const { email, source } = emailProviderCheckInput;
            let accounts = await this.accountsDBService.findAccountByEmail(provider === 1 ? email.toLowerCase() : email);
            accounts = accounts.filter((x: any) => [
                ProviderType.auth0_email,
                ProviderType.google,
                ProviderType.auth0_unipass,
                ProviderType.aws_kms,
            ].includes(x.provider));
            if (accounts.length === 0) {
                if (email.toLowerCase().endsWith('@gmail.com') &&
                    !['dehero pre registration', 'loa'].includes(source === null || source === void 0 ? void 0 : source.toLowerCase())) {
                    return {
                        provider: ProviderType.google,
                    };
                }
                provider = this.apiConfigService.appConfig.kmsSources.includes(source === null || source === void 0 ? void 0 : source.toLowerCase())
                    ? ProviderType.aws_kms
                    : provider;
                return {
                    provider,
                };
            }
            const providerAccount = accounts.filter((x: any) => [provider].includes(x.provider));
            if (providerAccount.length === 1) {
                return {
                    provider,
                };
            }
            return {
                provider: accounts[0].provider,
            };
        }
}
