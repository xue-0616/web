import { Body, Controller, Post, Request } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerBaseApiResponse } from '../../interfaces';
import { LoginOutput, OAuthSendCodeOutput } from './dto/send.code.output';

@Controller('oauth')
@ApiTags('oauth')
export class OauthController {
    constructor(oauthService: any) {
        this.oauthService = oauthService;
    }
    oauthService: any;
    @Post('send')
    @ApiResponse({ type: SwaggerBaseApiResponse(OAuthSendCodeOutput) })
    async sendCode(@Body() input: any, @Request() req: any) {
            const data = await this.oauthService.sendCode(input, req.ip);
            return data;
        }
    @Post('login')
    @ApiResponse({ type: SwaggerBaseApiResponse(LoginOutput) })
    async signUpOrLogin(@Body() input: any) {
            const data = await this.oauthService.signUpOrLogin(input);
            return data;
        }
}
