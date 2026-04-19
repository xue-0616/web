import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../up-jwt/up-jwt.guard';
import { SwaggerBaseApiResponse } from '../../interfaces';
import { TssOutput } from './dto/start.keygen.output';

@Controller('custom-auth-account/tss')
@ApiTags('custom-auth-account/tss')
@UseGuards(UpJwtGuard)
export class CustomAuthTssController {
    constructor(tssService: any) {
        this.tssService = tssService;
    }
    tssService: any;
    @ApiOperation({ summary: 'tss start_keygen' })
    @Post('/keygen/start')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async startKeyGen(@Request() req: any) {
            const data = await this.tssService.startKeyGen(req.user);
            return data;
        }
    @ApiOperation({ summary: 'tss  keygen' })
    @Post('/keygen')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async getKeygen(@Request() req: any, @Body() keyGenInput: any) {
            const data = await this.tssService.getKeygen(keyGenInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'tss  finish_keygen' })
    @Post('/keygen/finish')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async finishKeygen(@Request() req: any, @Body() finishKeygenInput: any) {
            const data = await this.tssService.finishKeygen(finishKeygenInput, req.user);
            return data;
        }
}
