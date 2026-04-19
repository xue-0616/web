import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CKBScript, CkbCellInputDto } from './dtos/ckb-cell.input.dto';
import { CkbCellOutputDto } from './dtos/ckb-cell.output';
import { PaymasterSigInputDto } from './dtos/paymaster-sig.input.dto';
import { PaymasterSigOutputDto } from './dtos/paymaster-sig.output';
import { SwaggerBaseApiResponse } from '../../common/interface/response';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { PaymasterService } from './paymaster.service';
import { SignService } from './sign.service';
import { ApiKeyGuard } from '../../guards/api-key.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { RateLimit } from '../../decorators/rate-limit.decorator';

@ApiTags('Paymaster')
@ApiHeader({ name: 'X-API-Key', description: 'API key for authentication', required: true })
@Controller('paymaster')
@UseGuards(ApiKeyGuard, RateLimitGuard)
export class PaymasterController {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly cellService: PaymasterService,
    private readonly signService: SignService,
  ) {
    this.logger.setContext(PaymasterController.name);
  }

  @ApiOperation({ summary: 'Get UDT Quota' })
  @ApiResponse({ type: SwaggerBaseApiResponse(String) })
  @Post('estimate-udt-amount')
  @RateLimit(60, 60) // 60 req/min for read endpoints
  async getUDTQuota(@Body() input: CKBScript): Promise<string> {
    return await this.cellService.getUDTQuota(input);
  }

  @ApiOperation({ summary: 'Get CKB Cell' })
  @ApiResponse({ type: SwaggerBaseApiResponse(CkbCellOutputDto) })
  @Post('get-ckb-cell')
  @RateLimit(60, 60) // 60 req/min for read endpoints
  async getCkbCell(@Body() input: CkbCellInputDto): Promise<CkbCellOutputDto> {
    return await this.cellService.getCkbCell(input);
  }

  @ApiOperation({ summary: 'Request Paymaster Signature' })
  @ApiResponse({ type: SwaggerBaseApiResponse(PaymasterSigOutputDto) })
  @Post('request-paymaster-sig')
  @RateLimit(10, 60) // 10 req/min for signing endpoint
  async requestPaymasterSig(
    @Body() input: PaymasterSigInputDto,
    @Req() req: any,
  ): Promise<PaymasterSigOutputDto> {
    const callerIp = req.ip || req._remoteAddress || 'unknown';
    const apiKeyHashPrefix = req.apiKeyHashPrefix || 'unknown';
    return await this.signService.signPaymasterInput(input, callerIp, apiKeyHashPrefix);
  }
}
