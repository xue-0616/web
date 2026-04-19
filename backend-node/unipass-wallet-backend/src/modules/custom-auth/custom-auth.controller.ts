import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerBaseApiResponse } from '../../interfaces';
import { CustomAuthConfigOutput, CustomAuthLoginOutput, CustomAuthRegisterOutput } from './dto';

@Controller('custom-auth-account')
@ApiTags('custom-auth-account')
export class CustomAuthController {
    constructor(customAuthService: any) {
        this.customAuthService = customAuthService;
    }
    customAuthService: any;
    @Post('login')
    @ApiOperation({
        summary: 'custom auth account login api',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(CustomAuthLoginOutput) })
    customAuthLogin(@Body() input: any) {
            const data = this.customAuthService.customAuthLogin(input);
            return data;
        }
    @Post('register')
    @ApiOperation({
        summary: 'custom auth account register account',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(CustomAuthRegisterOutput) })
    customAuthAccountRegister(@Body() input: any) {
            const data = this.customAuthService.customAuthAccountRegister(input);
            return data;
        }
    @Post('config')
    @ApiOperation({
        summary: 'custom auth config',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(CustomAuthConfigOutput) })
    web3authConfig(@Body() input: any) {
            const data = this.customAuthService.web3authConfig(input);
            return data;
        }
    @Get('oauth2/certs/:appId')
    @ApiOperation({
        summary: 'custom auth account public api key',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(CustomAuthLoginOutput) })
    getAppIdJwtPubkey(@Param('appId') appId: any) {
            const data = this.customAuthService.getAppIdJwtPubkey(appId);
            return data;
        }
}
