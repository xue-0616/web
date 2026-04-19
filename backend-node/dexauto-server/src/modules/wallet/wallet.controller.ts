import { Controller, Get, UseGuards, Request, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger } from 'nestjs-pino';
import { WalletService } from './wallet.service';
import { WalletOverviewResponse } from './dto/response.dto';
import { PinoLogger } from 'nestjs-pino';
import { buildSuccessResponse } from '../../common/dto/response';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/v1/wallet')
export class WalletController {
    private walletService: WalletService;
    private logger: PinoLogger;

    constructor(
        walletService: WalletService,
        @InjectPinoLogger(WalletController.name) logger: PinoLogger,
    ) {
        this.walletService = walletService;
        this.logger = logger;
    }

    @Get(':walletId/overview')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiResponse({ type: WalletOverviewResponse })
    async getSolanaWalletBalances(@Request() req: any, @Param('walletId') walletId: string): Promise<WalletOverviewResponse> {
        const userId = req.userId;
        const walletOverview = await this.walletService.getWalletOverview(userId, walletId);
        this.logger.info(`get wallet overview success: ${walletOverview}`);
        return buildSuccessResponse(walletOverview);
    }
    @Get('holdings')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    async getSolanaWalletHoldings(@Request() req: any): Promise<any> {
        const userId = req.userId;
        const holdings = await this.walletService.holdings(userId);
        this.logger.info(`get user holdings success: ${holdings}`);
        return buildSuccessResponse(holdings);
    }
}
