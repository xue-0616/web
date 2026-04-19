import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwaggerBaseApiResponse } from '../../../interfaces';
import { AuthAccountInfoOutput } from '../dto/token';

@ApiTags('oauth')
@Controller('token')
export class AccessTokenController {
    constructor(accessTokenService: any) {
        this.accessTokenService = accessTokenService;
    }
    accessTokenService: any;
    @Post('auth')
    @ApiOperation({
        summary: 'auth google or aws access_token return unipass info',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(AuthAccountInfoOutput) })
    async authAccountInfo(@Body() authAccountInfoInput: any) {
            const data = await this.accessTokenService.authAccountInfo(authAccountInfoInput);
            return data;
        }
}
