import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { WalletConnectInputDto } from './dto/wallet-connect.input.dto';
import { WalletService } from './wallet.service';
import { ForwardingApiInputDto } from './dto/forwarding-api.input.dto';
import { SwaggerBaseApiResponse } from '../../common/interface/response';
import { AppType } from './dto/app-query.input.dto';

@Controller('wallet')
@ApiTags('wallet')
export class WalletController {
    constructor(private readonly logger: AppLoggerService, private readonly walletService: WalletService) {
        this.logger.setContext(WalletController.name);
    }
    @Get('message')
    @ApiOperation({ summary: 'cache wallet message' })
    @ApiResponse({ type: SwaggerBaseApiResponse(undefined) })
    async connect(@Query() input: WalletConnectInputDto): Promise<void> {
            if (!input.data && !input.errorCode) {
                this.logger.warn(`[connect] input not match`);
                return;
            }
            return await this.walletService.saveMessage(AppType.Wallet, input.encryption_public_key ? input.encryption_public_key : input.nonce, {
                public_key: input.encryption_public_key,
                data: input.data,
                nonce: input.nonce,
                error_message: input.errorMessage,
                error_code: input.errorCode,
            });
        }
    @Post('solana')
    @ApiOperation({ summary: 'Forwarding SolanaaAPI' })
    @ApiResponse({ type: SwaggerBaseApiResponse(String) })
    async forwardingSolanaApi(@Body() input: ForwardingApiInputDto): Promise<string | null> {
            return await this.walletService.forwardingSolanaApi(input);
        }
}
