import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

@Controller('policy')
export class PolicyController {
    constructor(policyService: any) {
        this.policyService = policyService;
    }
    policyService: any;
    @Post('gas-fee-adjustment')
    @ApiOperation({
        summary: 'get gas fee adjustment',
    })
    async gasFeeAdjustment(@Body() input: any, @Req() req: any) {
            const appId = req.headers['x-up-app-id'];
            const data = await this.policyService.gasFeeAdjustment(input, appId);
            return data;
        }
    @Post('verify-transaction')
    @ApiOperation({
        summary: 'verify transaction',
    })
    async verifyTransaction(@Body() input: any, @Req() req: any) {
            const appId = req.headers['x-up-app-id'];
            const data = await this.policyService.verifyTransaction(input, appId);
            return data;
        }
}
