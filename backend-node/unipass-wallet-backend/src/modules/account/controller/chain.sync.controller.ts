import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { SwaggerBaseApiResponse } from '../../../interfaces';
import { GetSyncStatusOutput, GetTransactionOutPut, UpSignTokenOutput } from '../dto';

@ApiTags('sync')
@Controller('sync')
@UseGuards(UpJwtGuard)
export class ChainSyncController {
    constructor(chainSyncService: any, logger: any) {
        this.chainSyncService = chainSyncService;
        this.logger = logger;
        this.logger.setContext(ChainSyncController.name);
    }
    chainSyncService: any;
    logger: any;
    @ApiOperation({ summary: 'get account chain sync status' })
    @Post('status')
    @ApiResponse({
        type: SwaggerBaseApiResponse(GetSyncStatusOutput),
    })
    async getStatus(@Body() getSyncStatusInput: any, @Request() req: any) {
            const data = await this.chainSyncService.getStatus(getSyncStatusInput, req.user);
            return data;
        }
    @ApiOperation({ summary: 'sync account auth by OAuth' })
    @Post('auth.oauth')
    @ApiResponse({
        type: SwaggerBaseApiResponse(UpSignTokenOutput),
    })
    async syncByOAuthIdToken(@Body() syncByOAuthIdToken: any, @Request() req: any) {
            const data = await this.chainSyncService.syncByOAuthIdToken(syncByOAuthIdToken, req.user);
            return data;
        }
    @ApiOperation({ summary: 'get sync account transaction' })
    @Post('transaction')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetTransactionOutPut) })
    async getSyncTranscation(@Body() getTransactionInput: any, @Request() req: any) {
            const data = await this.chainSyncService.getTransactionDatas(getTransactionInput, req.user);
            return data;
        }
}
