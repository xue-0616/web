import { Body, Controller, Post } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ADMIN_PREFIX } from '../../admin/admin.constants';
import { IStatisticsRegisterDto } from '../../../modules/unipass/dto/app_sanp.dto';
import { PaymentSnapGasStatisticsService, PaymentTxStatisticsService, RegisterStatisticsService } from '../../../modules/unipass/payment_snap/server';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('payment_snap')
@Controller('payment_snap')
export class SnapAppStatisticsController {
  constructor(
    private readonly registerStatisticsService: RegisterStatisticsService,
    private readonly paymentSnapGasStatisticsService: PaymentSnapGasStatisticsService,
    private readonly paymentTxStatisticsService: PaymentTxStatisticsService,
  ) {}

  @Post('register/list')
  async accountRegisterList(@Body() dto: IStatisticsRegisterDto): Promise<any> {
    return this.registerStatisticsService.registerStatistics(dto);
  }

  @Post('gas/receive')
  async getGasReceiveList(@Body() dto: IStatisticsRegisterDto): Promise<any> {
    return this.paymentSnapGasStatisticsService.getGasReceiveList(dto);
  }

  @Post('gas/consume')
  async getGasConsumeList(@Body() dto: IStatisticsRegisterDto): Promise<any> {
    return this.paymentSnapGasStatisticsService.getGasConsumeList(dto);
  }

  @Post('gas/details')
  async getGasConsumeDetailList(@Body() dto: IStatisticsRegisterDto): Promise<any> {
    return this.paymentSnapGasStatisticsService.getGasConsumeDetailList(dto);
  }

  @Post('payment')
  async getPaymentList(@Body() dto: IStatisticsRegisterDto): Promise<any> {
    return this.paymentTxStatisticsService.getPaymentList(dto);
  }

  @Post('batch_payment')
  async getBatchPaymentList(@Body() dto: IStatisticsRegisterDto): Promise<any> {
    return this.paymentTxStatisticsService.getBatchPaymentList(dto);
  }
}
