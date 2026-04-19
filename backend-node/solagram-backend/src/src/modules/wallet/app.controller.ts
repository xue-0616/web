import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { PhantomConnectInputDto } from './dto/phantom-connect.input.dto';
import { PhantomSignMessageInputDto } from './dto/phantom-sign.input.dto';
import { AppQueryOutputDto } from './dto/app-query.output.dto';
import { AppQueryInputDto, AppType, MessageType } from './dto/app-query.input.dto';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { WalletService } from './wallet.service';
import { Response } from 'express';
import { TxRawDataInputDto } from './dto/tx-raw-data.input.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';

@Controller('app')
@ApiTags('app')
export class AppController {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly walletService: WalletService) {
        this.logger.setContext(AppController.name);
    }
    @Get('phantom/connect/:hash')
    @ApiOperation({ summary: 'phantom connect redirect link' })
    @ApiResponse({
        status: 301,
        description: 'Redirects to tg bot',
    })
    async connect(@Query() input: PhantomConnectInputDto, @Param() param: {
        hash: string;
    }, @Res() res: Response): Promise<void> {
            if (input.data || input.errorCode) {
                await this.walletService.saveMessage(AppType.Phantom, param.hash, {
                    public_key: input.phantom_encryption_public_key,
                    data: input.data,
                    nonce: input.nonce,
                    error_message: input.errorMessage,
                    error_code: input.errorCode,
                });
            }
            const redirectUrl = `tg://resolve?`;
            return res.redirect(redirectUrl);
        }
    @Get('phantom/sign/:hash')
    @ApiOperation({ summary: 'phantom sign message redirect link' })
    @ApiResponse({
        status: 301,
        description: 'Redirects to tg bot',
    })
    async signMessage(@Query() input: PhantomSignMessageInputDto, @Param() param: {
        hash: string;
    }, @Res() res: Response): Promise<void> {
            if (input.data || input.errorCode) {
                await this.walletService.saveMessage(AppType.Phantom, param.hash, {
                    data: input.data,
                    nonce: input.nonce,
                    error_message: input.errorMessage,
                    error_code: input.errorCode,
                });
            }
            const redirectUrl = `tg://resolve?`;
            return res.redirect(redirectUrl);
        }
    @Get('query')
    @ApiOperation({
        summary: 'query cache message',
    })
    @ApiResponse({ type: SwaggerBaseApiResponse(AppQueryOutputDto) })
    async queryData(@Query() input: AppQueryInputDto): Promise<AppQueryOutputDto> {
            return await this.walletService.queryMessage(input.walletType, input.key, input.messageType);
        }
    @Post('tx')
    @ApiOperation({ summary: 'save tx raw data' })
    @ApiResponse({ type: SwaggerBaseApiResponse(undefined) })
    async txRawData(@Body() input: TxRawDataInputDto): Promise<void> {
            await this.walletService.saveMessage(AppType.Wallet, input.nonce, input, MessageType.TxRawData);
            return;
        }
}
