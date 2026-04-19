import { BadRequestException, Injectable } from '@nestjs/common';
import moment from 'moment';
import { comparisonKey, getChallengeUuid, parseBuffer, toBuffer, verifyReqRegistrationResponseJSON } from '../../../shared/utils/webauthn';
import { StatusName, TIME } from '../../../shared/utils';
import { WebAuthnAction } from '../dto';
import { verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { AuthStatus, AuthType } from '../entities';

@Injectable()
export class WebauthnService {
    // Runtime-assigned fields (preserved from original source via decompilation).
    [key: string]: any;
    constructor(logger: any, apiConfigService: any, redisService: any, authenticatorsDBService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.redisService = redisService;
        this.authenticatorsDBService = authenticatorsDBService;
        this.logger.setContext(WebauthnService.name);
    }
    logger: any;
    apiConfigService: any;
    redisService: any;
    authenticatorsDBService: any;
    async getWebAuthnChallenge(account: any, input: any) {
            const { address } = account;
            const { credentialID, action } = input;
            const name = `${address}:${credentialID}:${action}:${moment().unix()}`;
            const challenge = getChallengeUuid(name);
            const key = `${address}:${credentialID}:${action}`;
            await this.redisService.saveCacheData(key, challenge, TIME.ONE_MINUTE);
            return { challenge };
        }
    async verifyWebAuthn(account: any, input: any, req: any) {
            const { address } = account;
            const data = await this.findOneWebAuthByCredentialID(account, input.id);
            const { id } = input;
            if (!data) {
                throw new BadRequestException(StatusName.CERDENTIALD_NOT_REGIATER);
            }
            const key = `${address}:${id}:${WebAuthnAction.Login}`;
            const rpID = this.apiConfigService.getWebAuthnConfig.rpId;
            const userAgent = req.headers['user-agent'];
            const challenge = await this.redisService.getCacheData(key);
            const options = {
                response: input,
                expectedChallenge: challenge,
                expectedOrigin: userAgent,
                expectedRPID: rpID,
                authenticator: data.authenticator,
            };
            const { isVerified } = await this.verifyAuthenticationResponse(options, data.keyInfo, data.authId, account);
            return { isVerified };
        }
    async verifyAuthenticationResponse(verifyOptions: any, keyInfo: any, authId: any, account: any) {
            try {
                const verification = await verifyAuthenticationResponse(verifyOptions);
                const { authenticationInfo, verified: isVerified } = verification;
                if (!isVerified) {
                    this.logger.log(`verifyAuthenticationResponse fail ${isVerified} from ${account.email}_${account.provider}`);
                    throw new BadRequestException(StatusName.WEBAUTHN_VERIFY_ERROR);
                }
                else {
                    const { newCounter } = authenticationInfo;
                    keyInfo.counter = newCounter;
                    await this.authenticatorsDBService.updateDB(authId, {
                        value: JSON.stringify(keyInfo),
                        updatedAt: new Date(),
                    });
                }
                return { isVerified };
            }
            catch (error) {
                this.logger.warn(`[verifyRegisterWebauthn] verify errror ${error}`);
            }
            throw new BadRequestException(StatusName.WEBAUTHN_VERIFY_ERROR);
        }
    async findOneWebAuthByCredentialID(account: any, credentialID: any) {
            const where = {
                accountId: account.id,
                type: AuthType.WebAuthn,
                status: AuthStatus.Open,
            };
            const list = await this.authenticatorsDBService.findMany(where);
            for (const item of list) {
                try {
                    const keyInfo = JSON.parse(JSON.stringify(item.value));
                    if (keyInfo.credentialID === credentialID) {
                        const authenticator = {
                            credentialPublicKey: toBuffer(keyInfo.credentialPublicKey),
                            credentialID: toBuffer(keyInfo.credentialID),
                            counter: keyInfo.counter,
                            transports: keyInfo.transports,
                        };
                        return { authenticator, keyInfo, authId: item.id };
                    }
                }
                catch (_a) {
                    continue;
                }
            }
        }
    async verifyRegisterWebauthn(value: any, account: any, req: any, deviceInfo: any) {
            const { email, provider, address } = account;
            let webauthnData;
            const userAgent = req.headers['user-agent'];
            const rpID = this.apiConfigService.getWebAuthnConfig.rpId;
            try {
                webauthnData = JSON.stringify(value);
            }
            catch (error) {
                this.logger.warn(`[verifyRegisterWebauthn] parse json error ${error} value = ${value} from ${email}_${provider}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const key = `${address}:${webauthnData.id}:${WebAuthnAction.Register}`;
            const challenge = await this.redisService.getCacheData(key);
            verifyReqRegistrationResponseJSON(webauthnData, challenge, deviceInfo);
            const verifyOptions = {
                response: webauthnData,
                expectedChallenge: challenge,
                expectedOrigin: userAgent,
                expectedRPID: rpID,
            };
            const { authenticator } = await this.verifyRegisterResponse(verifyOptions);
            const keyValue = await this.getWebauthnKeyValue(account, authenticator, deviceInfo);
            return keyValue;
        }
    async verifyRegisterResponse(verifyOptions: any) {
            try {
                const verification = await verifyRegistrationResponse(verifyOptions);
                const { registrationInfo, verified: isVerified } = verification;
                if (!registrationInfo || !isVerified) {
                    throw new BadRequestException(StatusName.WEBAUTHN_VERIFY_ERROR);
                }
                const { credentialPublicKey, credentialID, counter } = registrationInfo as any;
                const authenticator = {
                    credentialID: parseBuffer(credentialID),
                    credentialPublicKey: parseBuffer(credentialPublicKey),
                    counter,
                };
                return { isVerified, authenticator };
            }
            catch (error) {
                this.logger.warn(`[verifyRegisterWebauthn] verify errror ${error}`);
            }
            throw new BadRequestException(StatusName.WEBAUTHN_VERIFY_ERROR);
        }
    async getWebauthnKeyValue(account: any, authenticator: any, deviceInfo: any) {
            const keyInfo = Object.assign(Object.assign({}, authenticator), { updateTime: moment().format('YYYY-MM-DD HH:mm'), deviceInfo });
            const where = {
                id: account.id,
                type: AuthType.WebAuthn,
            };
            const list = await this.authenticatorsDBService.findMany(where);
            let value = '';
            for (const item of list) {
                const isMatch = comparisonKey(keyInfo.credentialID, item.value);
                if (isMatch) {
                    return value;
                }
            }
            value = JSON.stringify(keyInfo);
            return value;
        }
}
