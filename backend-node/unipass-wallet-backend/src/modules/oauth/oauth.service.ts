import { BadRequestException, Injectable } from '@nestjs/common';
import { SendType } from './dto/send.code.input';
import { StatusName } from '../../shared/utils';
import { ProviderType } from '../account/entities';

@Injectable()
export class OauthService {
    constructor(logger: any, optOauthService: any, awsService: any, accountsService: any, accessTokenService: any) {
        this.logger = logger;
        this.optOauthService = optOauthService;
        this.awsService = awsService;
        this.accountsService = accountsService;
        this.accessTokenService = accessTokenService;
        this.logger.setContext(OauthService.name);
    }
    logger: any;
    optOauthService: any;
    awsService: any;
    accountsService: any;
    accessTokenService: any;
    async sendCode(input: any, ip: any) {
            const { sendType, email, source } = input;
            if (sendType === SendType.email && !email) {
                this.logger.warn(`[sendCode] input email not find ${ip} email = ${email}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const { provider } = await this.accountsService.getEmailProviderCheck({ email: email, source }, ProviderType.aws_kms);
            if (provider !== ProviderType.aws_kms) {
                this.logger.log(`[verifyCode]email provider error email=${email} provider=${ProviderType.aws_kms} checkProvider= ${provider}`);
                return { provider };
            }
            await this.optOauthService.sendEmailCode(email);
            return { provider: ProviderType.aws_kms };
        }
    async signUpOrLogin(input: any) {
            const { email, code } = input;
            if (!email) {
                this.logger.warn('[verifyCode] input email not find');
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            await this.optOauthService.verifyEmailCode(`kms_${email}`, code);
            const data = await this.awsService.getUserPoolIdToken(email);
            if (!data) {
                this.logger.error('[signUpOrLogin] aws user pool find data null error');
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const { account, isRegistered, upJwtToken } = await this.accessTokenService.initUniPassAccount(email.toLocaleLowerCase(), ProviderType.aws_kms, data === null || data === void 0 ? void 0 : data.sub);
            if (!isRegistered) {
                return {
                    provider: ProviderType.aws_kms,
                    isRegistered,
                    authorization: upJwtToken.authorization,
                    upSignToken: upJwtToken.upSignToken,
                    cognitoResult: data.cognitoResult,
                };
            }
            const unipassInfo = await this.accessTokenService.getAccountKeyInfo(account);
            return {
                cognitoResult: data.cognitoResult,
                provider: ProviderType.aws_kms,
                isRegistered,
                authorization: upJwtToken.authorization,
                upSignToken: upJwtToken.upSignToken,
                unipassInfo,
                isPending: account.status,
                createdAt: account.createdAt,
            };
        }
}
