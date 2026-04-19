import { Body, Controller, Post } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ADMIN_PREFIX } from '../admin/admin.constants';
import { IStatisticsDto, IStatisticsEventsDetailsDto, IStatisticsEventsDto, IStatisticsLoginDto, IStatisticsSignupDto, IUnipassChainInfoListOutput, IUniPassUserChainInfoDto, IUniPassUserDBInfoDto, IUniPassUserInfoOutputDto } from '../../modules/unipass/dto/unipass.dto';
import { UnipassService } from '../../modules/unipass/unipass.service';
import { StatisticsService } from '../../modules/unipass/statistics.service';
import { PaginatedResponseDto } from '../../common/class/res.class';
import { TransactionService } from '../../modules/unipass/chain/transaction.service';
import { IUniPassTransactionDto } from '../../modules/unipass/dto/unipass.transaction.dto';
import { AccountEventService } from '../../modules/unipass/monitor/account.evnets';
import { AccountTypeInput, RelayerGasInput } from '../../modules/unipass/dto/relayer.input';
import { GasStatisticsService } from '../../modules/unipass/relayer/gas.statistics.service';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('UniPass')
@Controller('')
export class UnipassController {
  constructor(
    private readonly unipassService: UnipassService,
    private readonly statisticsService: StatisticsService,
    private readonly transactionService: TransactionService,
    private readonly accountEventService: AccountEventService,
    private readonly gasStatisticsService: GasStatisticsService,
  ) {}

  @Post('account/db/info')
  async getUnipassUserDbInfo(@Body() dto: IUniPassUserDBInfoDto): Promise<IUniPassUserInfoOutputDto[]> {
    return this.unipassService.getUnipassUserDbInfo(dto);
  }

  @Post('account/chain/info')
  async getUnipassUserChainInfo(@Body() dto: IUniPassUserChainInfoDto): Promise<IUnipassChainInfoListOutput[]> {
    return this.unipassService.getUnipassUserChainInfo(dto);
  }

  @Post('account/event/info')
  async getUnipassEventInfo(@Body() dto: IUniPassUserChainInfoDto): Promise<any> {
    return this.unipassService.getUnipassEventInfo(dto);
  }

  @Post('statistics/signup')
  async statisticsSignUp(@Body() dto: IStatisticsDto): Promise<PaginatedResponseDto<IStatisticsSignupDto>> {
    this.accountEventService.initRegister();
    return this.statisticsService.statisticsSignUp(dto);
  }

  @Post('statistics/login')
  async statisticsLogin(@Body() dto: IStatisticsDto): Promise<PaginatedResponseDto<IStatisticsLoginDto>> {
    return this.statisticsService.statisticsLogin(dto);
  }

  @Post('elastic/sign/logs')
  async elasticLogin(@Body() dto: IStatisticsDto): Promise<any> {
    return this.statisticsService.statisticsSign(dto);
  }

  @Post('send/tranascation')
  async sendTransaction(@Body() dto: IUniPassTransactionDto): Promise<any> {
    return this.transactionService.sendTransaction(dto.address, String(dto.value));
  }

  @Post('statistics/oneday')
  async statisticsOneDayInfo(@Body() dto: IStatisticsDto): Promise<any> {
    return this.statisticsService.statisticsOnedayInfo(dto);
  }

  @Post('statistics/oneday/login')
  async statisticsOneDayLogin(@Body() dto: IStatisticsEventsDetailsDto): Promise<any> {
    return this.statisticsService.statisticsOneDayLogin(dto);
  }

  @Post('statistics/oneday/signup')
  async statisticsOneDaySignUp(@Body() dto: IStatisticsEventsDetailsDto): Promise<any> {
    return this.statisticsService.statisticsOneDaySignUp(dto);
  }

  @Post('moduleguest/tranascation')
  async getModuleguestTranascation(@Body() dto: IStatisticsDto): Promise<any> {
    return this.unipassService.getModuleGuestTranascation(dto);
  }

  @Post('tranascation/event/list')
  async eventList(@Body() dto: IStatisticsEventsDto): Promise<any> {
    return this.accountEventService.getEventList(dto);
  }

  @Post('tranascation/event/details')
  async getEventDetails(@Body() dto: IStatisticsEventsDetailsDto): Promise<any> {
    return this.accountEventService.getEventDetailsList(dto);
  }

  @Post('statistics/accounts/transaction')
  async allAccountsTx(@Body() dto: IStatisticsDto): Promise<any> {
    return this.statisticsService.statisticsAccountsTransaction(dto);
  }

  @Post('statistics/gas/list')
  async getRelayerGasInfo(@Body() input: RelayerGasInput): Promise<any> {
    return this.gasStatisticsService.getRelayerGasList(input);
  }

  @Post('statistics/gas/day')
  async getRelayerGasTracker(@Body() input: RelayerGasInput): Promise<any> {
    return this.gasStatisticsService.getIncomeSummary(input);
  }

  @Post('statistics/gas/earnings')
  async getAccountEarningsData(@Body() input: AccountTypeInput): Promise<any> {
    return this.gasStatisticsService.getEarningsData(input.isAccountTx);
  }

  @Post('statistics/wallet/register')
  async walletRegisterStatistics(@Body() dto: IStatisticsDto): Promise<any> {
    return this.statisticsService.walletRegisterStatistics(dto);
  }
}
