import { BadRequestException, Injectable } from '@nestjs/common';
import { getUniPassWhiteListAccount } from '../../../shared/utils/unipass.whitelist';
import { AccountStatus, ProviderType } from '../entities';
import { StatusName, TIME, hideSecurityInformation } from '../../../shared/utils';
import { Wallet } from 'ethers';

@Injectable()
export class AccessTokenService {
    constructor(upHttpService: any, accountsDBService: any, accountsService: any, upJwtTokenService: any, oriHashDBService: any, apiConfig: any, keyService: any, logger: any, syncAccountService: any, loginRecordsDBService: any) {
        this.upHttpService = upHttpService;
        this.accountsDBService = accountsDBService;
        this.accountsService = accountsService;
        this.upJwtTokenService = upJwtTokenService;
        this.oriHashDBService = oriHashDBService;
        this.apiConfig = apiConfig;
        this.keyService = keyService;
        this.logger = logger;
        this.syncAccountService = syncAccountService;
        this.loginRecordsDBService = loginRecordsDBService;
        this.logger.setContext(AccessTokenService.name);
    }
    upHttpService: any;
    accountsDBService: any;
    accountsService: any;
    upJwtTokenService: any;
    oriHashDBService: any;
    apiConfig: any;
    keyService: any;
    logger: any;
    syncAccountService: any;
    loginRecordsDBService: any;
    async getUserInfoFromGoogle(accessToken: any) {
            const url = 'https://www.googleapis.com/oauth2/v2/userinfo';
            const headers = {
                authorization: `Bearer ${accessToken}`,
                'content-type': 'application/json',
            };
            const data = await this.upHttpService.httpGet(url, { headers });
            if (!data) {
                return undefined;
            }
            const googleInfo = data;
            if (!googleInfo.email) {
                return undefined;
            }
            return {
                sub: googleInfo.id,
                email: googleInfo.email,
            };
        }
    async getUserInfoFromAuth0(accessToken: any) {
            const url = `https://${this.apiConfig.auth0Config.authODomain}/userinfo`;
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                'content-type': 'application/json',
            };
            const userInfo = await getUniPassWhiteListAccount(accessToken, this.accountsDBService);
            if (userInfo) {
                return userInfo;
            }
            const data = await this.upHttpService.httpGet(url, { headers });
            if (!data) {
                return undefined;
            }
            const auth0Info = data;
            if (!auth0Info.email) {
                return undefined;
            }
            return {
                sub: auth0Info.sub,
                email: auth0Info.email,
            };
        }
    async getAccessTokenData(authAccountInfoInput: any) {
            const { accessToken, provider } = authAccountInfoInput;
            let accessData;
            switch (provider) {
                case ProviderType.google:
                    accessData = await this.getUserInfoFromGoogle(accessToken);
                    break;
                case ProviderType.auth0_email:
                case ProviderType.auth0_apple:
                case ProviderType.auth0_unipass:
                    accessData = await this.getUserInfoFromAuth0(accessToken);
                    break;
            }
            if (!accessData) {
                this.logger.warn('[getAccessTokenData] accessData is null');
                throw new BadRequestException(StatusName.ACCESS_TOKEN_ERROR);
            }
            return accessData;
        }
    async getUnJwtToken(provider: any, accessData: any, isRegistered: any) {
            const { email, sub } = accessData;
            const expiresIn = isRegistered
                ? this.apiConfig.jwtConfig.signOptions.expiresIn
                : '24h';
            const payload = {
                email,
                provider,
                sub,
            };
            let authorization = '';
            let upSignToken = '';
            const jwtToken = this.upJwtTokenService.createToken(payload, expiresIn);
            authorization = jwtToken.authorization;
            if (isRegistered) {
                const tokens = await this.upJwtTokenService.createUpSignToken(email, provider, TIME.MINUTES_OF_DAY, sub);
                authorization = tokens.authorization;
                upSignToken = tokens.upSignToken;
            }
            return { authorization, upSignToken };
        }
    async initAccount(email: any, provider: any, sub: any) {
            const tempAddress = Wallet.createRandom();
            await this.accountsDBService.insertDB(tempAddress.address, email, AccountStatus.generateKey, provider, sub);
        }
    async authAccountInfo(authAccountInfoInput: any) {
            const { provider, source } = authAccountInfoInput;
            const accessData = await this.getAccessTokenData(authAccountInfoInput);
            const { email, sub } = accessData;
            if (provider !== ProviderType.auth0_apple) {
                const { provider: checkProvider } = await this.accountsService.getEmailProviderCheck({ email, source }, provider);
                if (checkProvider !== provider) {
                    this.logger.log(`email provider error email=${email} provider=${provider} checkProvider= ${checkProvider}`);
                    return { provider: checkProvider };
                }
            }
            const { account, isRegistered, upJwtToken } = await this.initUniPassAccount(email, provider, sub);
            if (!isRegistered) {
                return {
                    provider,
                    isRegistered,
                    authorization: upJwtToken.authorization,
                    upSignToken: upJwtToken.upSignToken,
                };
            }
            const unipassInfo = await this.getAccountKeyInfo(account);
            await this.loginRecordsDBService.insertDB(account === null || account === void 0 ? void 0 : account.id);
            return {
                provider,
                isRegistered,
                isPending: account.status,
                createdAt: account.createdAt,
                authorization: upJwtToken.authorization,
                upSignToken: upJwtToken.upSignToken,
                unipassInfo,
            };
        }
    async initUniPassAccount(email: any, provider: any, sub: any) {
            let account = await this.accountsDBService.findOneInfo(email, provider);
            const isRegistered = account && account.status > AccountStatus.generateKey ? true : false;
            if (!account) {
                await this.initAccount(email, provider, sub);
                account = await this.accountsDBService.findOneInfo(email, provider);
            }
            if (isRegistered) {
                account = (await this.syncAccountService.syncAccountByUserSync(email, provider, true));
            }
            const upJwtToken = await this.getUnJwtToken(provider, { email, sub }, isRegistered);
            return {
                account: account,
                isRegistered,
                upJwtToken,
            };
        }
    async getAccountKeyInfo({ status, initKeysetHash, keysetHash, id, address }: any, inputWeb3authAddress?: any) {
            if (status === AccountStatus.migrated) {
                this.logger.warn(`[getAccountKeyInfo] status = ${status} address = ${address} is migrated`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            const { masterKeyAddress, keyset } = await this.oriHashDBService.getKeyset(status === AccountStatus.pending ? initKeysetHash : keysetHash);
            const keysetData = hideSecurityInformation({ masterKeyAddress, keyset }, this.logger);
            const { keystore, keyType, web3authAddress } = await this.keyService.getKeystore(id, masterKeyAddress);
            if (inputWeb3authAddress &&
                web3authAddress &&
                web3authAddress.toLowerCase() !== inputWeb3authAddress.toLowerCase()) {
                this.logger.warn(`[getAccountKeyInfo] inputWeb3authAddress${inputWeb3authAddress} web3authAddress= ${web3authAddress}`);
                throw new BadRequestException(StatusName.WEB3AUTH_ERROR);
            }
            const unipassInfo = {
                keystore,
                keyset: keysetData.keyset,
                address,
                keyType,
            };
            return unipassInfo;
        }
}
