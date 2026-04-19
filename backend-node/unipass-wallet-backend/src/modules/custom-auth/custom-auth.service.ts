import { BadRequestException, Injectable } from '@nestjs/common';
import { CustomAuthDBService } from './custom-auth.db.service';
import { StatusName, getKeysetData, verifyK1Sign } from '../../shared/utils';
import { AccountStatus, AlgType, KeyStatus } from '../account/entities';
import { KeyType } from '../../interfaces';
import { createPublicKey } from 'crypto';

@Injectable()
export class CustomAuthService {
    constructor(logger: any, accessTokenService: any, customAuthDbService: any, customAuthAppInfoDbService: any, upJwtTokenService: any, queryAbiService: any, keyService: any, apiConfigService: any, jwtService: any) {
        this.logger = logger;
        this.accessTokenService = accessTokenService;
        this.customAuthDbService = customAuthDbService;
        this.customAuthAppInfoDbService = customAuthAppInfoDbService;
        this.upJwtTokenService = upJwtTokenService;
        this.queryAbiService = queryAbiService;
        this.keyService = keyService;
        this.apiConfigService = apiConfigService;
        this.jwtService = jwtService;
        logger.setContext(CustomAuthDBService.name);
    }
    logger: any;
    accessTokenService: any;
    customAuthDbService: any;
    customAuthAppInfoDbService: any;
    upJwtTokenService: any;
    queryAbiService: any;
    keyService: any;
    apiConfigService: any;
    jwtService: any;
    async getSubByPayload(message: any, appId: any) {
            const appInfo = await this.customAuthAppInfoDbService.getAppInfo({ appId });
            const jwtVerifierId = appInfo.jwtVerifierIdKey;
            const sub = JSON.parse(message)[jwtVerifierId];
            if (!sub) {
                this.logger.warn(`[getSubByPayload] sub is null jwtVerifierId=${jwtVerifierId} message= ${message}`);
                throw new BadRequestException(StatusName.APPID_NOT_SUPPORT);
            }
            return sub;
        }
    async customAuthLogin(input: any) {
            this.verifyWeb3Auth(input.web3auth);
            const sub = await this.getSubByPayload(input.web3auth.message, input.appId);
            const { account, isRegistered, authorization } = await this.initcustomAuthUniPassAccount(input, sub, input.web3auth.message);
            if (!isRegistered) {
                return { isRegistered, authorization };
            }
            const { status, initKeysetHash, keysetHash, id, address } = account;
            const unipassInfo = await this.accessTokenService.getAccountKeyInfo({ status, initKeysetHash, keysetHash, id, address }, input.web3auth.address);
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
            const authorization = this.getAuthorization({ sub, email: '' }, appId, expirationInterval);
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
            this.logger.log(`${JSON.stringify(input)}`);
            let sub = input.masterKey.masterKeyAddress;
            const { appId, expirationInterval, masterKey, keysetJson } = input;
            if (masterKey.keyType === KeyType.CUSTOM_AUTH && !input.web3auth) {
                this.logger.warn('[customAuthAccountRegister] keyType ==5 !input.web3auth');
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            if (input.web3auth) {
                this.verifyWeb3Auth(input.web3auth);
                sub = await this.getSubByPayload(input.web3auth.message, input.appId);
            }
            const account = await this.initAccount(sub, input.appId, input.web3auth ? input.web3auth.message : JSON.stringify({ eoa: sub }));
            if (account.status > AccountStatus.generateKey) {
                this.logger.warn(`[customAuthAccountRegister] account status not generateKey account.status =${account.status}`);
                throw new BadRequestException(StatusName.ACCOUNT_EXISTS);
            }
            const { id, email } = account;
            input.masterKey = this.keyService.checkMasterKey(input.masterKey);
            const address = await this.queryAbiService.getContractAddressAndCheckRegistration(keysetJson, true);
            const { keyStore, masterKeyAddress, keyType } = masterKey;
            const { keyset } = getKeysetData(keysetJson, this.logger, email, keyType);
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
            const authorization = this.getAuthorization({ sub, email: email ? email : '' }, appId, expirationInterval);
            const data = {
                authorization,
                address,
                keysetHash: initKeysetHash,
            };
            return data;
        }
    getAuthorization(accessData: any, appId: any, expirationInterval: any) {
            const { sub } = accessData;
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
            let unipassRelayerUrl = this.apiConfigService.getEnvKey(`CUSTOM_RELAYER_${chainId}`);
            const appInfo = await this.customAuthAppInfoDbService.getAppInfo({
                appId,
            });
            return {
                unipassRelayerUrl,
                web3authConfig: {
                    clientId: appInfo.web3authClientId,
                    verifierName: appInfo.verifierName,
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
            if (!jwtPubkey && !idToken) {
                return [];
            }
            const idTokenInfo = this.jwtService.decode(idToken, {
                complete: true,
            });
            const header = idTokenInfo.header;
            const key = createPublicKey(jwtPubkey);
            const obj = key.export({ format: 'jwk' });
            return { keys: [Object.assign(Object.assign({}, obj), { kid: header.kid, alg: header.alg, use: 'sig' })] };
        }
    verifyWeb3Auth(web3auth: any) {
            let isVerify = false;
            try {
                const { address, sig, message } = web3auth;
                isVerify = verifyK1Sign(message, sig, address);
            }
            catch (error) {
                this.logger.warn(`verifyWeb3Auth error = ${error}`);
            }
            if (!isVerify) {
                this.logger.warn(`verifyWeb3Auth isVerify = ${isVerify}`);
                throw new BadRequestException(StatusName.WEB3AUTH_ERROR);
            }
        }
}
