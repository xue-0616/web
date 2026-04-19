import { Body, Controller, Post } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseApiResponse, SwaggerBaseApiResponse } from '../../../interfaces';
import { DeductOutput, GetUsdToAPOutput } from '../dto/transaction.ap.output';

@Controller('ap')
@ApiTags('ap-tx')
export class ActionPointTransactionController {
    constructor(transactionService: any) {
        this.transactionService = transactionService;
    }
    transactionService: any;
    @Post('usd-to-ap')
    @ApiResponse({ type: SwaggerBaseApiResponse(GetUsdToAPOutput) })
    getUsdToApConversionRateByAddress(@Body() input: any) {
            return this.transactionService.getUsdToApConversionRateByAddress(input);
        }
    @Post('lock')
    @ApiResponse({ type: BaseApiResponse })
    async lockActionPoint(@Body() input: any) {
            await this.transactionService.lockActionPoint(input);
        }
    @Post('deduct')
    @ApiResponse({ type: SwaggerBaseApiResponse(DeductOutput) })
    async deductActionPoint(@Body() input: any) {
            return await this.transactionService.deductActionPoint(input);
        }
}
