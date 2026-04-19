import { BadRequestException, Injectable } from '@nestjs/common';
import { StatusName, getKeysetData, hideSecurityInformation, verifyWeb3AuthSignature } from '../../shared/utils';
import { AccountStatus } from './entities/custom-auth.accounts.entity';
import { KeyType } from '../../interfaces';
import { AlgType } from './entities/ori.hash.entity';
import { KeyStatus } from './entities/key.list.entity';
import { createPublicKey } from 'crypto';

@Injectable()
export class CustomAuthService {
    constructor(logger: any, oriHashDBService: any, customAuthDbService: any, customAuthAppInfoDbService: any, upJwtTokenService: any, queryAbiService: any, keyService: any, apiConfigService: any, jwtService: any) {
        this.logger = logger;
        this.oriHashDBService = oriHashDBService;
        this.customAuthDbService = customAuthDbService;
        this.customAuthAppInfoDbService = customAuthAppInfoDbService;
        this.upJwtTokenService = upJwtTokenService;
        this.queryAbiService = queryAbiService;
        this.keyService = keyService;
        this.apiConfigService = apiConfigService;
        this.jwtService = jwtService;
        logger.setContext(CustomAuthService.name);
    }
    logger: any;
    oriHashDBService: any;
    customAuthDbService: any;
    customAuthAppInfoDbService: any;
    upJwtTokenService: any;
    queryAbiService: any;
    keyService: any;
    apiConfigService: any;
    jwtService: any;
    getSubByPayload(message: any, appInfo: any) {
            const jwtVerifierId = appInfo.jwtVerifierIdKey;
            let sub;
            try {
                sub = JSON.parse(message)[jwtVerifierId];
            }
            catch (error) {
                this.logger.warn(`[getSubByPayload] ${message} ${error}`);
                throw new BadRequestException(StatusName.APPID_NOT_SUPPORT);
            }
            if (!sub) {
                this.logger.warn(`[getSubByPayload] sub is null jwtVerifierId=${jwtVerifierId} message= ${message}`);
                throw new BadRequestException(StatusName.APPID_NOT_SUPPORT);
            }
            return sub;
        }
    async customAuthLogin(input: any) {
            verifyWeb3AuthSignature(this.logger, input.web3auth);
            const appInfo = await this.verifyAppId(input.appId);
            const sub = this.getSubByPayload(input.web3auth.message, appInfo);
            const { account, isRegistered, authorization } = await this.initcustomAuthUniPassAccount(input, sub, input.web3auth.message);
            if (!isRegistered) {
                return { isRegistered, authorization };
            }
            const { status, initKeysetHash, keysetHash, id, address } = account;
            const unipassInfo = await this.getAccountKeyInfo({ status, initKeysetHash, keysetHash, id, address }, input.web3auth.address);
            const data = {
                authorization,
                isRegistered,
                unipassInfo,
            };
            return data;
        }
    async initAccount(sub: any, appId: any, userInfo: any) {
            let account = await this.customAuthDbService.findOne(sub, appId);
            if (!account) {
                await this.customAuthDbService.insertToOrUpdateCustomAuthDb({
                    sub,
                    appId,
                    userInfo,
                });
                account = await this.customAuthDbService.findOne(sub, appId);
            }
            return account;
        }
    async initcustomAuthUniPassAccount(input: any, sub: any, userInfo: any) {
            const { expirationInterval, appId } = input;
            let account = await this.initAccount(sub, appId, userInfo);
            const isRegistered = account && account.status > AccountStatus.generateKey ? true : false;
            const authorization = this.getAuthorization({ sub, appId }, expirationInterval);
            if (!isRegistered) {
                return {
                    isRegistered,
                    authorization,
                };
            }
            return {
                isRegistered,
                authorization,
                account,
            };
        }
    async customAuthAccountRegister(input: any) {
            var _a;
            let sub = input.masterKey.masterKeyAddress;
            const { appId, expirationInterval, masterKey, keysetJson } = input;
            const appInfo = await this.verifyAppId(appId);
            if (masterKey.keyType === KeyType.CUSTOM_AUTH && !input.web3auth) {
                this.logger.warn('[customAuthAccountRegister] keyType ==5 !input.web3auth');
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            if (input.web3auth) {
                verifyWeb3AuthSignature(this.logger, input.web3auth);
                sub = this.getSubByPayload(input.web3auth.message, appInfo);
            }
            const account = await this.initAccount(sub, input.appId, input.web3auth ? input.web3auth.message : JSON.stringify({ eoa: sub }));
            if (account.status > AccountStatus.generateKey) {
                this.logger.warn(`[customAuthAccountRegister] login account ${JSON.stringify({
                    address: account.address,
                    sub: account.sub,
                    appId: account.appId,
                    id: account.id,
                    chianId: account.chainId,
                    status: account.status,
                })} `);
                throw new BadRequestException(StatusName.ACCOUNT_EXISTS);
            }
            const { id } = account;
            input.masterKey = this.keyService.checkMasterKey(input.masterKey);
            const address = this.queryAbiService.getContractAddressAndCheckRegistration(keysetJson);
            const { keyStore, masterKeyAddress, keyType } = masterKey;
            const { keyset } = getKeysetData(keysetJson, this.logger);
            const initKeysetHash = keyset.hash();
            const update = {
                id,
                address,
                status: AccountStatus.pending,
                initKeysetHash,
                updatedAt: new Date(),
            };
            const rawHashInfo = {
                raw: JSON.stringify({
                    keyset: keyset.toJson(),
                    originEmails: [],
                    masterKeyAddress: masterKey.masterKeyAddress,
                }),
                alg: AlgType.keysetHash,
                hash: initKeysetHash,
            };
            const iKeyDbInfo = {
                accountId: id,
                keystore: keyStore,
                keyType: keyType,
                address: masterKeyAddress,
                status: KeyStatus.pending,
                web3AuthAddress: input.web3auth ? (_a = input.web3auth) === null || _a === void 0 ? void 0 : _a.address : undefined,
            };
            const isRegister = await this.customAuthDbService.initToBAccountForChain(update, rawHashInfo, iKeyDbInfo);
            this.logger.log(`customAuthAccountRegister status = ${isRegister}`);
            if (!isRegister) {
                throw new BadRequestException(StatusName.ACCOUNT_EXISTS);
            }
            const authorization = this.getAuthorization({ sub, appId }, expirationInterval);
            const data = {
                authorization,
                address,
                keysetHash: initKeysetHash,
            };
            return data;
        }
    async verifyAppId(appId: any) {
            const appInfo = await this.customAuthAppInfoDbService.getAppInfo({ appId });
            if (!appInfo) {
                this.logger.warn(`[verifyAppId] appInfo is null ${appId}`);
                throw new BadRequestException(StatusName.APPID_NOT_SUPPORT);
            }
            return appInfo;
        }
    getAuthorization(accessData: any, expirationInterval: any) {
            const { sub, appId } = accessData;
            const expiresIn = expirationInterval ? expirationInterval : '30d';
            const payload = {
                appId,
                sub,
                isToB: true,
            };
            let authorization = '';
            const jwtToken = this.upJwtTokenService.createToken(payload, expiresIn);
            authorization = jwtToken.authorization;
            return authorization;
        }
    async web3authConfig(input: any) {
            const { chainId, appId } = input;
            let customRelayer = this.apiConfigService.getContractConfig.customRelayer;
            const unipassRelayerUrl = customRelayer[chainId]
                ? customRelayer[chainId]
                : '';
            const appInfo = await this.customAuthAppInfoDbService.getAppInfo({
                appId,
            });
            return {
                unipassRelayerUrl,
                web3authConfig: {
                    clientId: appInfo.web3authClientId,
                    verifierName: appInfo.verifierName,
                    env: appInfo.web3authEnv,
                },
                jwtVerifierIdKey: appInfo.jwtVerifierIdKey,
            };
        }
    async getAppIdJwtPubkey(appId: any) {
            const data = await this.customAuthAppInfoDbService.getAppInfo({ appId });
            this.logger.log(`${appId} bind data.jwtPubkey = ${JSON.stringify(data)}`);
            if (!data || !data.jwtPubkey) {
                return [];
            }
            const jwtPubkey = data.jwtPubkey.publicKey;
            const idToken = data.jwtPubkey.idToken;
            const kid = data.jwtPubkey.kid;
            const alg = data.jwtPubkey.alg;
            if (!jwtPubkey && (Boolean(idToken) || !kid)) {
                return [];
            }
            let key;
            try {
                key = createPublicKey(jwtPubkey);
            }
            catch (error) {
                this.logger.error(`jwtPubkey createPublickey error ${error} data ${jwtPubkey}`);
                return [];
            }
            const obj = key.export({ format: 'jwk' });
            if (idToken) {
                const idTokenInfo = this.jwtService.decode(idToken, {
                    complete: true,
                });
                const header = idTokenInfo.header;
                return {
                    keys: [Object.assign(Object.assign({}, obj), { kid: header.kid, alg: header.alg, use: 'sig' })],
                };
            }
            if (!alg) {
                return [];
            }
            return { keys: [Object.assign(Object.assign({}, obj), { kid, alg, use: 'sig' })] };
        }
    async getAccountKeyInfo({ status, initKeysetHash, keysetHash, id, address }: any, inputWeb3authAddress: any) {
            const { masterKeyAddress, keyset } = await this.oriHashDBService.getKeyset(status === AccountStatus.pending ? initKeysetHash : keysetHash);
            const keysetData = hideSecurityInformation({ masterKeyAddress, keyset }, this.logger);
            const { keystore, keyType, web3authAddress, keyId } = await this.keyService.getKeystore(id, masterKeyAddress);
            if (inputWeb3authAddress &&
                web3authAddress &&
                web3authAddress.toLowerCase() !== inputWeb3authAddress.toLowerCase()) {
                this.logger.warn(`[getAccountKeyInfo] inputWeb3authAddress = ${inputWeb3authAddress} web3authAddress= ${web3authAddress}`);
                throw new BadRequestException(StatusName.WEB3AUTH_ERROR);
            }
            if (keyType === KeyType.WEB3_AUTH &&
                !web3authAddress &&
                inputWeb3authAddress) {
                await this.keyService.updateWeb3authAddress(keyId, inputWeb3authAddress);
            }
            const unipassInfo = {
                keystore,
                keyset: keysetData.keyset,
                address,
                keyType,
            };
            return unipassInfo;
        }
    async updateAccountStatus(input: any) {
            const { address, chainId, appId } = input;
            const accountInfo = await this.customAuthDbService.findOneByWhere({
                address,
                appId,
            });
            if (!accountInfo) {
                this.logger.log(`[updateAccountStatus] account not find by address ${address}`);
                return;
            }
            if (accountInfo.status === AccountStatus.committed) {
                this.logger.log(`[updateAccountStatus] account status is  ${AccountStatus.committed}`);
                return;
            }
            accountInfo.chainId = chainId;
            accountInfo.updatedAt = new Date();
            accountInfo.status = AccountStatus.committed;
            await this.customAuthDbService.updateCustomAuthDb(accountInfo);
            this.logger.log(`[updateAccountStatus] update success ${JSON.stringify({
                address,
                chainId,
                status: accountInfo.status,
            })}`);
        }
}
