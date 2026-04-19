import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { SwaggerBaseApiResponse } from '../../../interfaces/Response';
import { AddAuthenticatorOutput, AuthenticatorListOutput, AuthenticatorStatusOutput, DeleteAuthenticatorOuput, GetGoogleAuthenticatorQRCodeOutput, UpSignTokenOutput, WebAuthnVerifyOutput } from '../dto';

@ApiTags('2fa')
@Controller('2fa')
@UseGuards(UpJwtGuard)
export class AuthController {
    constructor(logger: any, authenticatorsService: any, webauthnService: any) {
        this.logger = logger;
        this.authenticatorsService = authenticatorsService;
        this.webauthnService = webauthnService;
        this.logger.setContext(AuthController.name);
    }
    logger: any;
    authenticatorsService: any;
    webauthnService: any;
    @ApiOperation({ summary: 'get google authentiaction qr code data' })
    @Post('ga/qrcode')
    @ApiResponse({
        type: SwaggerBaseApiResponse(GetGoogleAuthenticatorQRCodeOutput),
    })
    async getGoogleAuthenticatorQRCode(@Request() req: any) {
            const data = await this.authenticatorsService.getGoogleAuthenticatorQRCode(req.user);
            return data;
        }
    @ApiOperation({ summary: 'add bind 2fa data' })
    @Post('add')
    @ApiResponse({
        type: SwaggerBaseApiResponse(AddAuthenticatorOutput),
    })
    async AddAuthenticatorInput(@Request() req: any, @Body() addAuthenticatorInput: any) {
            const data = await this.authenticatorsService.AddAuthenticator(addAuthenticatorInput, req.user, req);
            return data;
        }
    @ApiOperation({ summary: 'set 2fa open status' })
    @Post('open.status')
    @ApiResponse({
        type: SwaggerBaseApiResponse(AuthenticatorStatusOutput),
    })
    async set2FaOpenStatus(@Request() req: any, @Body() authenticatorStatusInput: any) {
            const data = await this.authenticatorsService.set2FaOpenStatus(authenticatorStatusInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'set 2fa bind status' })
    @Post('del')
    @ApiResponse({
        type: SwaggerBaseApiResponse(DeleteAuthenticatorOuput),
    })
    async deleteAuthenticator(@Request() req: any, @Body() deleteAuthenticatorInput: any) {
            const data = await this.authenticatorsService.deleteAuthenticator(deleteAuthenticatorInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'set account 2fa auth list' })
    @Post('list')
    @ApiResponse({
        type: SwaggerBaseApiResponse(AuthenticatorListOutput),
    })
    async getAccount2FaAuthList(@Request() req: any, @Body() authenticatorListInput: any) {
            const data = await this.authenticatorsService.getAccount2FaAuthList(authenticatorListInput, req.user, req.ip);
            return data;
        }
    @ApiOperation({ summary: 'get webauthn challenge' })
    @Get('webauthn/challenge')
    @ApiResponse({
        type: SwaggerBaseApiResponse(AuthenticatorListOutput),
    })
    async getWebAuthnChallenge(@Request() req: any, @Body() input: any) {
            const data = await this.webauthnService.getWebAuthnChallenge(req.user, input);
            return data;
        }
    @ApiOperation({ summary: 'get webauthn challenge' })
    @Get('webauthn/verify')
    @ApiResponse({
        type: SwaggerBaseApiResponse(WebAuthnVerifyOutput),
    })
    async verifyWebAuthn(@Body() input: any, @Request() req: any) {
            const data = await this.webauthnService.verifyWebAuthn(req.user, input, req);
            return data;
        }
    @Post('/up-sign-token')
    @ApiOperation({ summary: 'get up_sign_token' })
    @ApiResponse({
        type: SwaggerBaseApiResponse(UpSignTokenOutput),
    })
    async getUpSignToken(@Request() req: any, @Body() input: any) {
            const data = await this.authenticatorsService.getUpSignToken(req.user, input);
            return data;
        }
}
