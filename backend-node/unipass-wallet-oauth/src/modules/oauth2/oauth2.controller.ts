import { RequestContext } from '../../interfaces';
import { AuthTokenInput, AuthorizeInput, ClientInput, SendEmailCodeInput, VerifyEmailCodeInput } from './dto';
import { OAuth2Service } from './oauth2.service';
import { Body, Controller, Get, Post, Query, Redirect, Request } from '@nestjs/common';

// Recovered from dist/oauth2.controller.js.map (source: ../../../src/modules/oauth2/oauth2.controller.ts)
@Controller('oauth2')
export class OAuth2Controller {
    constructor(private readonly oauth2Service: OAuth2Service) {}

    @Get('client')
    async oauthClient(@Query() input: ClientInput) {
        return await this.oauth2Service.oauthClient(input);
    }

    @Get('authorize')
    @Redirect()
    async oauthAuthorize(@Query() input: AuthorizeInput) {
        const url = await this.oauth2Service.oauthAuthorize(input);
        return { url };
    }

    @Post('token')
    @Redirect()
    async oauthToken(@Body() input: AuthTokenInput) {
        const url = await this.oauth2Service.oauthToken(input);
        return { url };
    }

    @Get('userInfo')
    async getEmailInfo(@Request() req: RequestContext & { headers?: { authorization?: string } }) {
        const accessToken = req.headers?.authorization;
        if (!accessToken) {
            return undefined;
        }
        const token = accessToken.replace('Bearer ', '');
        return await this.oauth2Service.verifyAccessToken(token);
    }

    @Post('start')
    async sendEmailCode(@Body() input: SendEmailCodeInput, @Request() req: RequestContext & { ip?: string }) {
        return await this.oauth2Service.sendAuthCode(input, req.ip ?? '');
    }

    @Post('verify')
    async verifyEmailCode(@Body() input: VerifyEmailCodeInput) {
        return await this.oauth2Service.verifyAuthCode(input);
    }
}
