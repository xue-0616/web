import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

@Controller('gas-tank')
export class GasTankController {
    constructor(policyService: any) {
        this.policyService = policyService;
    }
    policyService: any;
    @Post('consume-gas')
    @ApiOperation({
        summary: 'consume-gas',
    })
    async consumeGas(@Body() input: any, @Req() req: any) {
            const appId = req.headers['x-up-app-id'];
            const data = await this.policyService.consumeGas(input, appId);
            return data;
        }
}
