// Recovered from dist/oauth2.service.js.map (source: ../../../src/modules/oauth2/oauth2.service.ts)
import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as querystringify from 'querystringify';
import { Queue } from 'bull';
import { RequestContext, TemplateType } from '../../interfaces';
import { ApiConfigService, AppLoggerService, RedisService } from '../../shared/services';
import { SEND_EMAIL_CODE_JOB, SEND_EMAIL_QUEUE, StatusName, TIME } from '../../shared/utils';
import { IpreCaptchaService } from '../otp/ip.recaptcha.service';
import { OtpCodeBaseService } from '../otp/service/otp.base.service';
import { AuthTokenInput, AuthorizeInput, ClientInput, OAuth2Action, SendEmailCodeInput, VerifyEmailCodeInput } from './dto';
import { ProviderType } from './entities/oauth2.client.entity';
import { OAuth2ClientEntity } from './entities/oauth2.client.entity';
import { OAuth2EmailEntity } from './entities/oauth2.email.entity';
import { OAuth2DBService } from './oauth2.db.service';

@Injectable()
export class OAuth2Service {
    constructor(
        private readonly otpCodeBaseService: OtpCodeBaseService,
        private readonly redisService: RedisService,
        private readonly oauth2DBService: OAuth2DBService,
        private readonly logger: AppLoggerService,
        private readonly jwtService: JwtService,
        private readonly apiConfigService: ApiConfigService,
        private readonly ipreCaptchaService: IpreCaptchaService,
        @InjectQueue(SEND_EMAIL_QUEUE) private readonly sendEmailQueue: Queue,
    ) {}

    async oauthClient(input: ClientInput): Promise<OAuth2ClientEntity | undefined> {
        const clientId = await this.oauth2DBService.insertDB(input);
        return await this.oauth2DBService.findOne(clientId);
    }

    async oauthAuthorize(input: AuthorizeInput): Promise<string> {
        const client = await this.oauth2DBService.findOne(input.client_id);
        if (!client) {
            throw new BadRequestException('client not found');
        }
        await this.redisService.saveCacheData(`${input.client_id}:${input.state}`, JSON.stringify(input), TIME.HALF_HOUR);
        return input.redirect_uri || client.webServerRedirectUri.split(',').map((item) => item.trim()).filter(Boolean)[0] || '';
    }

    async oauthToken(input: AuthTokenInput): Promise<string> {
        const clientId = input.client_id;
        if (!clientId) {
            throw new BadRequestException('client_id is required');
        }
        const email = await this.redisService.getCacheData(`verify:${clientId}:${input.code}`);
        if (!email) {
            throw new BadRequestException(StatusName.OTP_CODE_ERROR);
        }
        const client = await this.oauth2DBService.findOne(clientId);
        if (!client) {
            throw new BadRequestException('client not found');
        }
        return await this.buildTokenRedirectUrl(client, input.redirect_uri, String(email));
    }

    async sendEmailCode(email: string, action = OAuth2Action.Login, provider = ProviderType.auth0_unipass, key: string, clientId: string, templateType: TemplateType): Promise<void> {
        const ctx = new RequestContext();
        await this.otpCodeBaseService.getSendCodeTimes(key);
        const code = await (this.otpCodeBaseService as any).getSendCode(ctx, action, `${email}_${provider}:${clientId}`);
        await this.otpCodeBaseService.saveSendCodeTimes(ctx, key);
        this.logger.log(`[sendEmailCode] key= ${key} code=${code}`);
        if (action === OAuth2Action.Login) {
            await this.sendEmailQueue.add(SEND_EMAIL_CODE_JOB, {
                ctx,
                email,
                code,
                templateType,
            });
        }
    }

    async sendAuthCode(input: SendEmailCodeInput, ip: string): Promise<void> {
        const { email, action = OAuth2Action.Login, client_id: clientId = '', authParams, response } = input;
        const normalizedAction = action === OAuth2Action.Login ? OAuth2Action.Login : OAuth2Action.Login;
        const client = await this.oauth2DBService.findOne(clientId);
        if (!client) {
            this.logger.warn(`[sendAuthCode] clientId ${clientId} data not find`);
            throw new BadRequestException('client not found');
        }
        const state = authParams?.state ?? '';
        const uiLocales = authParams?.ui_locales ?? '';
        const data = await this.redisService.getCacheData(`${clientId}:${state}`);
        if (!data || !uiLocales) {
            this.logger.warn(`[sendAuthCode] state ${state} or uiLocales ${uiLocales} data not find`);
        }
        let templateType = TemplateType.unipass;
        try {
            const { theme } = JSON.parse(uiLocales || '{}');
            if (String(theme).toLocaleLowerCase() === 'cassava') {
                templateType = TemplateType.cassava;
            }
        } catch {
            this.logger.warn(`[sendAuthCode] state ${uiLocales}  data error`);
        }
        if (!response) {
            this.logger.warn(`[sendAuthCode] reCAPTCHA response missing — blocking request from ip=${ip}`);
            throw new BadRequestException(StatusName.IP_VERIFY_ERROR);
        }
        const isVerified = await this.ipreCaptchaService.verifyReCaptchaResponse(response, ip);
        if (!isVerified) {
            this.logger.warn(`[sendAuthCode] reCAPTCHA verify failed for ip=${ip}`);
            throw new BadRequestException(StatusName.IP_VERIFY_ERROR);
        }
        await this.oauth2DBService.insertDBOAuthEmail({
            email,
            clientId,
            emailVerified: false,
        });
        const key = `oauth2_${email}_${ProviderType.auth0_unipass}:${clientId}`;
        await this.sendEmailCode(email, normalizedAction, ProviderType.auth0_unipass, key, clientId, templateType);
    }

    async verifyAuthCode(input: VerifyEmailCodeInput): Promise<void> {
        const { email, action = OAuth2Action.Login, client_id: clientId = '', code } = input;
        const key = `${email}_${ProviderType.auth0_unipass}:${clientId}`;
        const isVerified = await this.verifyEmailCode(key, action, code, true);
        if (!isVerified) {
            throw new BadRequestException(StatusName.OTP_CODE_ERROR);
        }
        await this.oauth2DBService.insertDBOAuthEmail({
            email,
            clientId,
            emailVerified: true,
        });
        await this.redisService.saveCacheData(`verify:${clientId}:${code}`, email, TIME.HALF_HOUR);
    }

    async verifyEmailCode(key: string, action: string, code: string, isDelCode: boolean): Promise<boolean> {
        const ctx = new RequestContext();
        const codeData = await this.otpCodeBaseService.updateVerifyCodeData(ctx, action, key);
        this.logger.log(`[verifyEmailCode] codeData= ${JSON.stringify(codeData)}, code = ${code}`);
        if (isDelCode && codeData?.code === code) {
            await this.otpCodeBaseService.removeCacheKey(`otc_${action}_${key}`);
        }
        return codeData?.code === code;
    }

    generateAccessToken(client: OAuth2ClientEntity, emailInfo?: OAuth2EmailEntity): string {
        const accessTokenInfo = {
            client: client.clientId,
            sub: emailInfo?.sub,
            email: emailInfo?.email,
            email_verified: emailInfo?.emailVerified,
        };
        return this.generateToken(accessTokenInfo, client);
    }

    generateToken(tokenPayload: Record<string, unknown>, client: OAuth2ClientEntity, showPrivateKey?: string): string {
        const option: Record<string, unknown> = {
            expiresIn: `${client.accessTokenValidity}m`,
            secret: client.clientSecret,
            privateKey: showPrivateKey,
        };
        if (showPrivateKey) {
            delete option.secret;
        }
        return this.jwtService.sign(tokenPayload, option as any);
    }

    async verifyAccessToken(accessToken: string): Promise<Record<string, unknown>> {
        let clientId = '';
        try {
            const decodeToken = this.jwtService.decode(accessToken) as Record<string, any> | null;
            clientId = String(decodeToken?.client ?? '');
        } catch (error) {
            this.logger.warn(`[verifyAccessToken] ${error}`);
        }
        if (!clientId) {
            return {};
        }
        const client = await this.oauth2DBService.findOne(clientId);
        try {
            return this.jwtService.verify(accessToken, {
                secret: client?.clientSecret,
            }) as Record<string, unknown>;
        } catch (error) {
            this.logger.warn(`[verifyAccessToken] ${error}`);
        }
        return {};
    }

    private async buildTokenRedirectUrl(client: OAuth2ClientEntity, redirectUri: string, email: string): Promise<string> {
        if (client.webServerRedirectUri) {
            const allowedUris = client.webServerRedirectUri.split(',').map((u) => u.trim()).filter(Boolean);
            if (!allowedUris.some((allowed) => redirectUri === allowed || redirectUri.startsWith(allowed))) {
                throw new BadRequestException('redirect_uri does not match registered redirect URIs');
            }
        } else {
            throw new BadRequestException('No redirect URIs registered for this client');
        }
        const emailInfo = await this.oauth2DBService.findOneOAuthEmail({
            clientId: client.clientId,
            email: email.toLocaleLowerCase(),
        });
        const accessToken = this.generateAccessToken(client, emailInfo);
        const expiresIn = Math.floor(Date.now() / 1000) + client.accessTokenValidity * 60;
        const data = {
            expires_in: expiresIn,
            access_token: accessToken,
            token_type: 'bearer',
            scope: client.scope,
        };
        return `${redirectUri}#${querystringify.stringify(data, false)}`;
    }
}
