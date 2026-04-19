import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { SwaggerBaseApiResponse } from '../../../interfaces';
import { TssOutput, UpSignTokenOutput } from '../dto';

@ApiTags('tss')
@Controller('tss')
@UseGuards(UpJwtGuard)
export class TssController {
    constructor(logger: any, tssService: any) {
        this.logger = logger;
        this.tssService = tssService;
        this.logger.setContext(TssController.name);
    }
    logger: any;
    tssService: any;
    @ApiOperation({ summary: 'generate local key step1 start_keygen' })
    @Post('/keygen/start')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async startKeyGen(@Request() req: any) {
            console.info(req.user);
            const data = await this.tssService.startKeyGen(req.user);
            return data;
        }
    @ApiOperation({ summary: 'generate local key step2 keygen' })
    @Post('/keygen')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async getKeygen(@Request() req: any, @Body() keyGenInput: any) {
            const data = await this.tssService.getKeygen(keyGenInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'generate local key step3 finish_keygen' })
    @Post('/keygen/finish')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async finishKeygen(@Request() req: any, @Body() finishKeygenInput: any) {
            const data = await this.tssService.finishKeygen(finishKeygenInput, req.user);
            return data;
        }
    @ApiOperation({
        summary: 'use tss local key + up key sign message step1 start sign',
    })
    @Post('/sign/start')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async startSign(@Request() ctx: any, @Body() startSignInput: any) {
            const data = await this.tssService.startSign(startSignInput, ctx.user);
            return data;
        }
    @ApiOperation({
        summary: 'use tss local key + up key sign message step2 sign',
    })
    @Post('/sign')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async getSign(@Request() ctx: any, @Body() signInput: any) {
            const data = await this.tssService.getSign(signInput, ctx.user);
            return data;
        }
    @ApiOperation({
        summary: 'audit tss sign api',
    })
    @Post('/audit')
    @ApiResponse({ type: SwaggerBaseApiResponse(TssOutput) })
    async startAudit(@Request() ctx: any, @Body() auditInput: any) {
            const headers = ctx.headers;
            const data = await this.tssService.startAudit(auditInput, ctx.user, headers);
            return data;
        }
    @ApiOperation({ summary: 'get up_sign_token' })
    @Post('/sign.token')
    @ApiResponse({ type: SwaggerBaseApiResponse(UpSignTokenOutput) })
    async getUpSignToken(@Request() req: any, @Body() upSignTokenInput: any) {
            const data = await this.tssService.getUpSignToken(req.user, upSignTokenInput);
            return data;
        }
}
