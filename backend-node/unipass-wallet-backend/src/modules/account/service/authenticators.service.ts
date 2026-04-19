import { BadRequestException, Injectable } from '@nestjs/common';
import moment from 'moment';
import { AuthStatus, AuthType } from '../entities';
import { StatusName, getFuzzyEmail, getFuzzyGa, getFuzzyPhone } from '../../../shared/utils';
import { OtpAction } from '../../otp/dtos';
import { Not } from 'typeorm';
import { showWebAuthnList } from '../../../shared/utils/webauthn';

@Injectable()
export class AuthenticatorsService {
    constructor(logger: any, googleAuthenticatorsService: any, authenticatorsDBService: any, otpService: any, ipreCaptchaService: any, otpCodeBaseService: any, unipassConfigService: any, redisService: any, webauthnService: any, jwtService: any, upJwtTokenService: any) {
        this.logger = logger;
        this.googleAuthenticatorsService = googleAuthenticatorsService;
        this.authenticatorsDBService = authenticatorsDBService;
        this.otpService = otpService;
        this.ipreCaptchaService = ipreCaptchaService;
        this.otpCodeBaseService = otpCodeBaseService;
        this.unipassConfigService = unipassConfigService;
        this.redisService = redisService;
        this.webauthnService = webauthnService;
        this.jwtService = jwtService;
        this.upJwtTokenService = upJwtTokenService;
        this.logger.setContext(AuthenticatorsService.name);
    }
    logger: any;
    googleAuthenticatorsService: any;
    authenticatorsDBService: any;
    otpService: any;
    ipreCaptchaService: any;
    otpCodeBaseService: any;
    unipassConfigService: any;
    redisService: any;
    webauthnService: any;
    jwtService: any;
    upJwtTokenService: any;
    async getGoogleAuthenticatorQRCode(account: any) {
            const qrData = await this.googleAuthenticatorsService.getGoogleAuthenticatorsQrCode(account.address, account.email);
            return qrData;
        }
    async AddAuthenticator(addAuthenticatorInput: any, account: any, req: any) {
            const { type, code, deviceInfo, idToken } = addAuthenticatorInput;
            const { email, address, id, sub } = account;
            let value = '';
            const noncePrefix = `${address}:add2fa:${type}`;
            this.verifyAuthIdToken(sub, noncePrefix, idToken);
            switch (type) {
                case AuthType.GoogleAuthenticator:
                    value =
                        await this.googleAuthenticatorsService.verifyGoogleAuthenticatorsToken(email, address, code, addAuthenticatorInput.value);
                    break;
                case AuthType.Phone:
                    await this.verifyBindPhone(addAuthenticatorInput.value, account, code);
                    value = addAuthenticatorInput.value;
                    break;
                case AuthType.WebAuthn:
                    value = await this.webauthnService.verifyRegisterWebauthn(addAuthenticatorInput.value, account, req, deviceInfo);
                    break;
            }
            if (value) {
                await this.authenticatorsDBService.insertDB(id, value, type);
                return {
                    bind: true,
                    status: AuthStatus.Open,
                };
            }
            return {
                bind: false,
                status: AuthStatus.Close,
            };
        }
    verifyAuthIdToken(sub: any, noncePrefix: any, idToken: any) {
            if (!idToken) {
                return;
            }
            try {
                const idTokenInfo = this.jwtService.decode(idToken);
                const now = moment().valueOf() / 1000;
                if (!idTokenInfo ||
                    idTokenInfo.exp < now ||
                    !idTokenInfo.nonce.startsWith(noncePrefix) ||
                    idTokenInfo.sub !== sub) {
                    this.logger.warn(`[verifyAuthIdToken] id noncePrefix not match noncePrefix ${noncePrefix},idTokenInfo.nonce ${idTokenInfo.nonce} 
            or sub not user sub ${sub},idTokenInfo.sub=${idTokenInfo.sub} now= ${now}`);
                    throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
                }
            }
            catch (_a) {
                throw new BadRequestException(StatusName.IDTOKEN_INFO_ERROR);
            }
        }
    async verifyBindPhone(value: any, account: any, code: any) {
            const { email, provider } = account;
            try {
                const bindPhone = JSON.parse(value);
                this.logger.log(`[verifyBindPhone] ${JSON.stringify(bindPhone)} from ${JSON.stringify({
                    email,
                    provider,
                })}`);
                const data = {
                    bindPhone,
                    action: OtpAction.BindPhone,
                    code,
                };
                await this.otpService.verify2FaCode(data, account);
            }
            catch (error) {
                this.logger.warn(`[verifyBindPhone] ${error},data = ${JSON.stringify({
                    value,
                    email,
                    code,
                })}`);
                throw new BadRequestException(StatusName.OTP_CODE_ERROR);
            }
        }
    async set2FaOpenStatus(authenticatorStatusInput: any, account: any) {
            const { status, type } = authenticatorStatusInput;
            await this.authenticatorsDBService.updateManyDB(account.id, type, {
                status,
                updatedAt: new Date(),
            });
            return { status };
        }
    async deleteAuthenticator(deleteAuthenticatorInput: any, account: any) {
            const { type, credentialIDs, idToken } = deleteAuthenticatorInput;
            const noncePrefix = `${account.address}:del2fa:${type}`;
            this.verifyAuthIdToken(account.sub, noncePrefix, idToken);
            let isBind = false;
            switch (type) {
                case AuthType.Email:
                    isBind = true;
                    break;
                case AuthType.WebAuthn:
                    isBind = await this.removeWebauthnKey(account, credentialIDs);
                    break;
                default:
                    isBind = await this.removeOtherAuthKey(type, account);
                    break;
            }
            return { bind: isBind };
        }
    async removeWebauthnKey(account: any, credentialIDs: any, isBind: any = false) {
            if (!credentialIDs || credentialIDs.length === 0) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const authDataList = await this.authenticatorsDBService.findMany({
                accountId: account.id,
                type: AuthType.WebAuthn,
                status: Not(AuthStatus.Remove),
            });
            const keyMap = new Map();
            for (const item of credentialIDs) {
                keyMap.set(item, item);
            }
            for (const item of authDataList) {
                let keyInfo;
                try {
                    keyInfo = JSON.parse(JSON.stringify(item.value));
                }
                catch (_a) {
                    continue;
                }
                if (keyMap.get(keyInfo.credentialID)) {
                    await this.authenticatorsDBService.updateDB(item.id, {
                        status: AuthStatus.Remove,
                        updatedAt: new Date(),
                    });
                }
            }
            return isBind;
        }
    async removeOtherAuthKey(type: any, account: any, isBind: any = false) {
            const authDataList = await this.authenticatorsDBService.findOne({
                accountId: account.id,
                type,
                status: Not(AuthStatus.Remove),
            });
            if (!authDataList) {
                return isBind;
            }
            await this.authenticatorsDBService.updateDB(authDataList.id, {
                status: AuthStatus.Remove,
                updatedAt: new Date(),
            });
            return isBind;
        }
    async getAccount2FaAuthList(authenticatorListInput: any, account: any, ip: any) {
            const { showAllStatus: isShowAllStatus, type } = authenticatorListInput;
            const where: any = isShowAllStatus
                ? { accountId: account.id, status: Not(AuthStatus.Remove) }
                : { accountId: account.id, status: AuthStatus.Open };
            if (type >= 0) {
                where.type = type;
            }
            const auth2FaData = await this.authenticatorsDBService.findMany(where);
            const authDataList = [];
            const isShowReCaptcha = await this.ipreCaptchaService.isNeedShowReCaptcha(ip);
            const webAuthnlist = [];
            for (const item of auth2FaData) {
                if (item.type === AuthType.WebAuthn) {
                    webAuthnlist.push(item);
                    continue;
                }
                const authData = {
                    type: item.type,
                    value: '',
                    status: item.status,
                    isShowReCaptcha,
                };
                const data = JSON.parse(JSON.stringify(item.value));
                switch (item.type) {
                    case AuthType.Email:
                        authData.value = getFuzzyEmail(data.email);
                        break;
                    case AuthType.Phone:
                        authData.value = getFuzzyPhone(data.phone, data.areaCode);
                        break;
                    case AuthType.GoogleAuthenticator:
                        authData.value = getFuzzyGa(data.base32);
                        break;
                    default:
                        continue;
                }
                authDataList.push(authData);
            }
            if (webAuthnlist.length > 0) {
                const auth = showWebAuthnList(webAuthnlist, isShowReCaptcha);
                authDataList.push(auth);
            }
            return authDataList;
        }
    async isSendOtpCode(account: any, send2FaCodeInput: any, ip: any) {
            const { action, authType, bindPhone, response } = send2FaCodeInput;
            if (action === OtpAction.BindPhone &&
                !(bindPhone === null || bindPhone === void 0 ? void 0 : bindPhone.phone) &&
                !(bindPhone === null || bindPhone === void 0 ? void 0 : bindPhone.areaCode)) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            let isSend = true;
            const isSendPhone = this.isSendPhone(send2FaCodeInput);
            if (account && action === OtpAction.Auth2Fa) {
                isSend = await this.getAuthData(account, authType, send2FaCodeInput);
                this.logger.log(`isSend=${isSend}`);
            }
            this.logger.log(`[isSendOtpCode]isSend=${JSON.stringify({
                isSend,
                ip,
                isSendPhone,
                bindPhone,
                account,
                authType,
            })}`);
            if (isSend && isSendPhone) {
                const isVerify = await this.ipreCaptchaService.isVerifyReCaptcha(ip, response);
                this.logger.log(`[isSendOtpCode] isVerify =${JSON.stringify({
                    isSend,
                    ip,
                    isSendPhone,
                    isVerify,
                    bindPhone,
                })}`);
                if (!isVerify) {
                    throw new BadRequestException(StatusName.IP_VERIFY_ERROR);
                }
            }
            return isSend;
        }
    isSendPhone(send2FaCodeInput: any) {
            const { action, authType } = send2FaCodeInput;
            if (action === OtpAction.BindPhone) {
                return true;
            }
            if (action === OtpAction.Auth2Fa && authType === AuthType.Phone) {
                return true;
            }
            return false;
        }
    async isSendVerify2FaData(account: any, verifyOtp2FaCodeInput: any) {
            const { action, authType, bindPhone } = verifyOtp2FaCodeInput;
            if (action === OtpAction.BindPhone &&
                !(bindPhone === null || bindPhone === void 0 ? void 0 : bindPhone.phone) &&
                !(bindPhone === null || bindPhone === void 0 ? void 0 : bindPhone.areaCode)) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            if (action === OtpAction.Auth2Fa) {
                const isSendVerify = await this.getAuthData(account, authType, verifyOtp2FaCodeInput);
                return isSendVerify;
            }
            return true;
        }
    async getAuthData(account: any, type: any, send2FaCodeInput: any) {
            const types = [AuthType.Email, AuthType.Phone];
            this.logger.log(`[getAuthData]type=${type}`);
            if (!types.includes(type)) {
                return false;
            }
            const auth = await this.authenticatorsDBService.findOne({
                accountId: account.id,
                type,
            });
            this.logger.log(`[getAuthData]auth=${auth}`);
            if (!auth) {
                return false;
            }
            const value = JSON.parse(JSON.stringify(auth.value));
            this.logger.log(`[getAuthData]value=${value}`);
            send2FaCodeInput.bindPhone = type === AuthType.Email ? undefined : value;
            this.logger.log(`[getAuthData]send2FaCodeInput=${JSON.stringify(send2FaCodeInput)}`);
            return true;
        }
    async verifyGoogleAuthenticator(account: any, verifyOtp2FaCodeInput: any) {
            const { action, authType, code } = verifyOtp2FaCodeInput;
            const types = [AuthType.GoogleAuthenticator];
            const { email, id, address, provider } = account;
            if (!types.includes(authType)) {
                throw new BadRequestException(StatusName.OTP_CODE_NOT_FIND);
            }
            const auth = await this.authenticatorsDBService.findOne({
                accountId: id,
                type: authType,
            });
            if (!auth) {
                throw new BadRequestException(StatusName.OTP_CODE_NOT_FIND);
            }
            const isWhiteList = this.unipassConfigService.isTestWhiteList(email);
            this.logger.log(`[verifyGoogleAuthenticator] AuthenticatorsService: isWhiteList = ${isWhiteList} `);
            if (!isWhiteList) {
                await this.googleAuthenticatorsService.verifyGoogleAuthenticatorsToken(email, address, code, undefined, JSON.stringify(auth.value));
            }
            const upAuthToken = await this.otpCodeBaseService.generateUpAuthToken(`${email}_${provider}`, action, undefined, 'ga');
            return { upAuthToken };
        }
    async verify2FaAuthToken(auth2FaToken: any, account: any, accountId: any, upAuthToken: any, isRecovery: any) {
            const { email, provider } = account;
            if (upAuthToken) {
                await this.otpCodeBaseService.verifyUpAuthToken(upAuthToken, OtpAction.PasswordLogin, `${email}_${provider}`, true);
            }
            const authList = await this.authenticatorsDBService.findMany({
                accountId,
                status: AuthStatus.Open,
            });
            const authMap = new Map();
            auth2FaToken.map((item: any) => {
                authMap.set(item.type, item);
            });
            let isAuth2FaToken = false;
            for (const item of authList) {
                const { value, type } = item;
                const tokenData = authMap.get(type);
                if (!tokenData) {
                    continue;
                }
                if (isRecovery && tokenData.type === AuthType.Email) {
                    continue;
                }
                await this.verify2FaToken(value, type, account, tokenData.upAuthToken);
                isAuth2FaToken = true;
            }
            this.logger.log(`[verify2FaAuthToken]  verify status =${JSON.stringify({
                isAuth2FaToken,
                upAuthToken,
                authList: authList.length,
            })}`);
            if (upAuthToken && !isAuth2FaToken) {
                throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            if (authList.length >= 2 && !isAuth2FaToken) {
                throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            if (!isRecovery && authList.length === 1 && !isAuth2FaToken) {
                throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            for (const item of authList) {
                const { value, type } = item;
                await this.deleteVerify2FaToken(value, type, email, provider);
            }
        }
    async verify2FaToken(value: any, type: any, account: any, upAuthToken: any) {
            const data = JSON.parse(JSON.stringify(value));
            let key = 'defaultkey';
            const { email, provider } = account;
            switch (type) {
                case AuthType.Email:
                    break;
                case AuthType.GoogleAuthenticator:
                    key = 'ga';
                    break;
                case AuthType.Phone:
                    key = `${data.areaCode}_${data.phone}`;
                    break;
                default:
                    throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            await this.otpCodeBaseService.verifyUpAuthToken(upAuthToken, OtpAction.Auth2Fa, `${email}_${provider}`, false, key);
        }
    async deleteVerify2FaToken(value: any, type: any, email: any, provider: any) {
            const data = JSON.parse(JSON.stringify(value));
            let key = 'defaultkey';
            switch (type) {
                case AuthType.Email:
                    break;
                case AuthType.GoogleAuthenticator:
                    key = 'ga';
                    break;
                case AuthType.Phone:
                    key = `${data.areaCode}_${data.phone}`;
                    break;
                default:
                    throw new BadRequestException(StatusName.OTP_TOKEN_ERROR);
            }
            key = `${email}_${provider}_${key}`;
            const cacheKey = `ott_${OtpAction.Auth2Fa}_${key}`;
            await this.redisService.deleteCacheData(cacheKey);
        }
    async getUpSignToken(accounts: any, input: any) {
            const { id, email, provider, sub, address } = accounts;
            const { authType, requestTokenDuration, code } = input;
            const auth = await this.authenticatorsDBService.findOne({
                accountId: id,
                type: authType,
            });
            if (!auth) {
                throw new BadRequestException(StatusName.OTP_CODE_NOT_FIND);
            }
            const action = OtpAction.Auth2Fa;
            const verifyOptCode: any = {
                action,
                code,
                authType,
            };
            switch (authType) {
                case AuthType.Email:
                    await this.otpService.verify2FaCode(verifyOptCode, accounts);
                    break;
                case AuthType.Phone:
                    verifyOptCode.bindPhone = JSON.parse(JSON.stringify(auth.value));
                    await this.otpService.verify2FaCode(verifyOptCode, accounts);
                    break;
                case AuthType.GoogleAuthenticator:
                    await this.googleAuthenticatorsService.verifyGoogleAuthenticatorsToken(email, address, code, undefined, JSON.stringify(auth.value));
                    break;
                case AuthType.WebAuthn:
                    break;
                default:
                    break;
            }
            const { authorization, upSignToken } = await this.upJwtTokenService.createUpSignToken(email, provider, requestTokenDuration, sub);
            return { authorization, upSignToken };
        }
}
