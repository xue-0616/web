import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { UpJwtGuard } from '../../../up-jwt/up-jwt.guard';
import { SwaggerBaseApiResponse } from '../../../interfaces';
import { EIP4337Output } from '../dto';

@Controller('account')
@ApiTags('account')
@UseGuards(UpJwtGuard)
export class EIP4337Controller {
    constructor(eip4337Service: any, logger: any) {
        this.eip4337Service = eip4337Service;
        this.logger = logger;
        this.logger.setContext(EIP4337Controller.name);
    }
    eip4337Service: any;
    logger: any;
    @ApiOperation({ summary: 'policy sign' })
    @ApiResponse({ type: SwaggerBaseApiResponse(EIP4337Output) })
    @Post('policy/sign')
    async getPolicySign(@Body() input: any, @Request() req: any) {
            const data = await this.eip4337Service.getPolicySign(input, req.user);
            return data;
        }
}
