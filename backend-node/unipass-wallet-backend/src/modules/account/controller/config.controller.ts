import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, Query, Redirect } from '@nestjs/common';
import { BaseApiResponse, SwaggerBaseApiResponse } from '../../../interfaces/Response';
import { SuffixesOutput } from '../../../shared/dto';
import { RequestContext } from '../../../interfaces';
import { EmailProviderCheckOutput } from '../dto';

@ApiTags('config')
@Controller('')
export class ConfigController {
    constructor(unipassConfigService: any, guardianService: any, apiConfigService: any, accountsService: any, logger: any) {
        this.unipassConfigService = unipassConfigService;
        this.guardianService = guardianService;
        this.apiConfigService = apiConfigService;
        this.accountsService = accountsService;
        this.logger = logger;
        this.logger.setContext(ConfigController.name);
    }
    unipassConfigService: any;
    guardianService: any;
    apiConfigService: any;
    accountsService: any;
    logger: any;
    @ApiOperation({ summary: 'get allowed mailbox suffixes config list' })
    @Get('config')
    @ApiResponse({ type: SwaggerBaseApiResponse(SuffixesOutput) })
    getConfig(@Query() suffixesInput: any) {
            const data = this.unipassConfigService.getConfig(suffixesInput);
            return data;
        }
    @ApiOperation({ summary: 'get cmc api' })
    @Post('price-conversion')
    @ApiResponse({ type: BaseApiResponse })
    async getPriceConversion(@Body() getPriceConversionInput: any) {
            const data = await this.unipassConfigService.getPriceConversion(getPriceConversionInput);
            return data;
        }
    @ApiOperation({ summary: 'verify guardian data' })
    @Get('account/guardian.verify')
    @Redirect()
    async verifyGuardian(@Query() verifyGuardianInput: any) {
            try {
                await this.guardianService.verifyGuardian(new RequestContext(), verifyGuardianInput);
            }
            catch (error) {
                this.logger.error(`[verifyGuardian] ${error},${(error as Error)?.stack}, data = ${JSON.stringify(verifyGuardianInput)}`);
            }
            const redirectUrl = this.apiConfigService.getOtpConfig.guardianUrl;
            return { url: redirectUrl };
        }
    @ApiOperation({ summary: 'email provider check' })
    @ApiResponse({ type: SwaggerBaseApiResponse(EmailProviderCheckOutput) })
    @Get('email/provider.check')
    async getEmailProviderCheck(@Query() emailProviderCheckInput: any) {
            const data = await this.accountsService.getEmailProviderCheck(emailProviderCheckInput);
            return data;
        }
}
