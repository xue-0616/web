import { BadRequestException, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Wallet } from 'ethers';
import { concat, Signature, sha256, toUtf8Bytes } from 'ethers';
import { StatusName } from '../../../shared/utils';
import { KeyStatus } from '../entities';
import { AuditStatus } from '../dto';

@Injectable()
export class TssService {
    constructor(logger: any, apiConfigService: any, httpService: any, keyDBService: any, redisService: any, jwtService: any, upJwtTokenService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.httpService = httpService;
        this.keyDBService = keyDBService;
        this.redisService = redisService;
        this.jwtService = jwtService;
        this.upJwtTokenService = upJwtTokenService;
        this.logger.setContext(TssService.name);
        this.wallet = new Wallet(apiConfigService.getTssConfig.privateKey);
    }
    logger: any;
    apiConfigService: any;
    httpService: any;
    keyDBService: any;
    redisService: any;
    jwtService: any;
    upJwtTokenService: any;
    wallet: any;
    async post(path: any, params: any = {}) {
            const url = `${this.apiConfigService.getTssConfig.host}/${path}`;
            const message = concat([
                toUtf8Bytes(`/${path}`),
                toUtf8Bytes(JSON.stringify(params)),
            ]);
            const hash = sha256(message);
            let signature = this.wallet.signingKey.sign(hash).serialized;
            signature = signature.slice(0, Math.max(0, signature.length - 2));
            this.logger.log(`[post] url = ${url}`);
            this.logger.log(`[post] body = ${JSON.stringify(params)}`);
            this.logger.log(`[post] signature = ${signature}`);
            try {
                const result = await this.httpService
                    .post(url, params, {
                    headers: {
                        signature,
                    },
                })
                    .toPromise();
                this.logger.log(`[post] tss result, ${JSON.stringify(result === null || result === void 0 ? void 0 : result.data)}`);
                return (result === null || result === void 0 ? void 0 : result.data) ? result === null || result === void 0 ? void 0 : result.data : true;
            }
            catch (error) {
                this.logger.error(`[post] TssService error ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    url,
                    signature,
                    params,
                })}`);
                return false;
            }
        }
    async startKeyGen({ id, email, provider, sub, }: any) {
            this.logger.log(`[generate key step]  startKeyGen email = ${email}_${provider} step create_keyId and /start_keygen/`);
            let tssEmail = email ? email : sub;
            const keyId = await this.post('create_keyId');
            const tssRes = await this.post(`start_keygen/${keyId}/${id}/${tssEmail}`);
            if (!tssRes) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            return {
                tssRes,
            };
        }
    async getKeygen(keyGenInput: any, { email, provider }: any) {
            const { sessionId, tssMsg } = keyGenInput;
            this.logger.log(`[generate key step]  getKeygen email = ${email}_${provider} step /keygen/`);
            const tssRes = await this.post(`keygen/${sessionId}`, { tssMsg });
            if (!tssRes) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            return {
                tssRes,
            };
        }
    async finishKeygen(finishKeygenInput: any, { email, provider, id }: any) {
            const { sessionId, userId, localKeyAddress } = finishKeygenInput;
            this.logger.log(`[generate key step]  finishKeygen email = ${email}_${provider} step  /finish_keygen/`);
            const tssRes = await this.post(`finish_keygen/${sessionId}`);
            if (!tssRes) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            await this.keyDBService.insertDB(id, '', localKeyAddress, KeyStatus.generateKey, userId);
            return {
                tssRes,
            };
        }
    async verifyLocalKeyUserId(localKeyAddress: any, accountId: any) {
            const key = await this.keyDBService.findOne({
                accountId,
                address: localKeyAddress,
            });
            if (!key || !key.uuid) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            return key.uuid;
        }
    async startAudit(auditInput: any, account: any, headers: any) {
            const { msg, content } = auditInput;
            const { email, provider } = account;
            if (!headers['up-sign-token'] || !content) {
                this.logger.log(`[startAudit]  headers up-sign-token not find herader = ${!headers['up-sign-token']} content = ${content}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const upSignToken = headers['up-sign-token'];
            await this.verifyUpSignToken(upSignToken, email, provider);
            const approveStatus = AuditStatus.Approved;
            await this.redisService.saveCacheData(msg, approveStatus);
            this.logger.log(`[startAudit] startSign email = ${email}_${provider} msg = ${msg} approveStatus = ${approveStatus}`);
            return { approveStatus };
        }
    async verifyUpSignToken(upSignToken: any, email: any, provider: any) {
            try {
                const data = this.jwtService.verify(upSignToken);
                const { email: signEmail, provider: signProvider, isDisposable, isUpSignToken, } = data;
                if (!isUpSignToken ||
                    (email !== signEmail && provider !== signProvider)) {
                    this.logger.warn(`[verifyUpSignToken] token is not up sign token or user info not match.
              isUpSignToken = ${isUpSignToken} userinfo = ${email}_${provider} sigToeknUserInfo=${signEmail}_${signProvider}`);
                    throw new BadRequestException(StatusName.UP_SIGN_TOKEN_ERROR);
                }
                if (isDisposable) {
                    const cacheUpSignToken = await this.redisService.getCacheData(`up_sign_token_${email}_${provider}`);
                    if (!cacheUpSignToken || cacheUpSignToken !== upSignToken) {
                        this.logger.warn(`[verifyUpSignToken] disposable token not find or not match. 
                cacheUpSignToken ${cacheUpSignToken} upSignToken = ${upSignToken}`);
                        throw new BadRequestException(StatusName.UP_SIGN_TOKEN_ERROR);
                    }
                    await this.redisService.deleteCacheData(`up_sign_token_${email}_${provider}`);
                }
            }
            catch (error) {
                this.logger.warn(`[verifyUpSignToken] verify upAuthToken  ${error}`);
                throw new BadRequestException(StatusName.UP_SIGN_TOKEN_ERROR);
            }
        }
    async startSign(startSignInput: any, account: any) {
            const { id, email, provider } = account;
            const { localKeyAddress, tssMsg, value } = startSignInput;
            const approveStatus = String(await this.redisService.getCacheData(value));
            this.logger.log(`[generate key step] startSign email = ${email}_${provider} step /start_sign/  approveStatus = ${approveStatus} value = ${value}`);
            if (!approveStatus || Number(approveStatus) !== AuditStatus.Approved) {
                throw new BadRequestException(StatusName.TSS_AUDIT_ERROR);
            }
            const keyId = await this.verifyLocalKeyUserId(localKeyAddress, id);
            const tssRes = await this.post(`start_sign/${keyId}`, { tssMsg, value });
            if (tssRes === false) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            await this.redisService.deleteCacheData(value);
            return {
                tssRes,
            };
        }
    async getSign(signInput: any, account: any) {
            const { email, provider } = account;
            const { tssMsg, sessionId, value } = signInput;
            this.logger.log(`[generate key step] getSign email = ${email}_${provider} step '/sign'`);
            const tssRes = await this.post(`sign/${sessionId}`, { tssMsg, value });
            if (tssRes === false) {
                throw new BadRequestException(StatusName.TSS_ERROR);
            }
            return {
                tssRes,
            };
        }
    async getUpSignToken(account: any, upSignTokenInput: any) {
            const { idToken, duration } = upSignTokenInput;
            const { sub, email, provider } = account;
            try {
                const idTokenInfo = this.jwtService.decode(idToken);
                const now = moment().valueOf() / 1000;
                if (!idTokenInfo ||
                    idTokenInfo.exp < now ||
                    idTokenInfo.sub !== sub ||
                    !idTokenInfo.nonce.startsWith('update-up-sign-token')) {
                    this.logger.warn(`getUpSignToken idtoken sub not match user sub or id token nonce not start with update-up-sign-token 
            idTokenInfo.sub =  ${idTokenInfo.sub} user.sub = ${sub}, idTokenInfo.nonce=${idTokenInfo.nonce} now = ${now}`);
                    throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
                }
            }
            catch (_a) {
                throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
            }
            const { authorization, upSignToken } = await this.upJwtTokenService.createUpSignToken(email, provider, duration, sub);
            return { authorization, upSignToken };
        }
}
