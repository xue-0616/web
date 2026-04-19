import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { SwaggerBaseApiResponse } from '../../../interfaces';
import { ActionPointBalanceOutput } from '../dto/issue.ap.output';
import { ShowActionPointHistoryOutput } from '../dto/show.ap.output';
import { GetApTransactionSignatureOutput } from '../dto/transaction.ap.output';

@Controller('ap')
@ApiTags('ap-show')
@UseGuards(UpJwtGuard)
export class ActionPointShowController {
    constructor(showService: any) {
        this.showService = showService;
    }
    showService: any;
    @Get('show/balance')
    @ApiResponse({ type: SwaggerBaseApiResponse(ActionPointBalanceOutput) })
    async getActionPointBalance(@Request() { user }: any) {
            const data = await this.showService.getActionPointBalance(user);
            return data;
        }
    @Post('show/history')
    @ApiResponse({
        type: SwaggerBaseApiResponse(ShowActionPointHistoryOutput),
    })
    async getActionPointHistory(@Body() input: any, @Request() { user }: any) {
            const data = await this.showService.getActionPointHistory(input, user);
            return data;
        }
    @Post('sig')
    @ApiResponse({
        type: SwaggerBaseApiResponse(GetApTransactionSignatureOutput),
    })
    async getApTransactionSignature(@Body() input: any, @Request() { user }: any) {
            return await this.showService.getApTransactionSignature(input, user);
        }
}
