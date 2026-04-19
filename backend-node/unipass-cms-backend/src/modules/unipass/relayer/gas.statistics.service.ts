import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { formatUnits } from 'ethers';
import { DataSource, Repository } from 'typeorm';
import { TxStatus } from '../../../entities/relayer/relaye.transactions.entity';
import { GasIncomeExpenseEntity } from '../../../entities/default/statistics/gas-income-expense.entity';
import { NATIVE_TOKEN_ADDRESS, nativeToken, sleep } from '../../../modules/unipass/chain/utils';
import { RelayerGasInput } from '../../../modules/unipass/dto/relayer.input';
import { RelayerService } from '../../../modules/unipass/relayer/relayer.service';
import { UnipassService } from '../../../modules/unipass/unipass.service';
import { ApiConfigService } from '../../../shared/services/api-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { UpHttpService } from '../../../shared/services/up.http.service';

const { Cron, CronExpression } = require('@nestjs/schedule');

type GasIncomeExpenseRecord = {
  relayerId?: string | number;
  chainId?: string;
  gmtUpdated?: string | Date;
  source?: string;
  txHash?: string;
  submitter?: string;
  to?: string;
  feeToken?: string;
  feeIncome?: string;
  transaction?: any;
  gasSpent?: string;
  gasPrice?: string;
  gasLimit?: string;
  [key: string]: any;
};

type PaginatedResult<T = any> = {
  list: T[];
  pagination: {
    total: number;
    size: number;
    page: number;
    allCount?: any;
  };
};

@Injectable()
export class GasStatisticsService {
  private dataSource!: DataSource;
  private walletDataSource!: DataSource;
  private defaultDataSource!: DataSource;

  constructor(
    @InjectRepository(GasIncomeExpenseEntity, 'default')
    private readonly gasIncomeExpenseRepository: Repository<GasIncomeExpenseEntity>,
    private readonly configService: ConfigService,
    private readonly relayerService: RelayerService,
    private readonly unipassService: UnipassService,
    private readonly redisService: RedisService,
    private readonly upHttpService: UpHttpService,
    private readonly apiConfigService: ApiConfigService,
  ) {
    this.initDataSource();
  }

  private initDataSource(): void {
    const defaultData = this.configService.get('database') || {};
    this.defaultDataSource = new DataSource({ ...(defaultData as object), name: 'default' } as any);
    if (!this.defaultDataSource.isInitialized) {
      void this.defaultDataSource.initialize().catch(() => undefined);
    }

    const relayerData = this.configService.get('relayer_database') || {};
    this.dataSource = new DataSource({ ...(relayerData as object), name: 'Relayer_db' } as any);
    if (!this.dataSource.isInitialized) {
      void this.dataSource.initialize().catch(() => undefined);
    }

    const walletData = this.configService.get('unipass_database') || {};
    this.walletDataSource = new DataSource({ ...(walletData as object), name: 'UniPass_db' } as any);
    if (!this.walletDataSource.isInitialized) {
      void this.walletDataSource.initialize().catch(() => undefined);
    }
  }

  private getDateText(value?: string | number): string {
    return value ? String(value) : format(new Date(), 'yyyy-MM-dd');
  }

  private getNextDateText(value?: string | number): string {
    return format(addDays(new Date(this.getDateText(value)), 1), 'yyyy-MM-dd');
  }

  private toHexAddress(value: any): string {
    if (!value) {
      return '';
    }
    if (Buffer.isBuffer(value)) {
      return `0x${value.toString('hex')}`;
    }
    if (typeof value === 'string' && value.startsWith('0x')) {
      return value;
    }
    if (typeof value === 'string') {
      return `0x${value}`;
    }
    return String(value);
  }

  private normalizeHexFilter(value: string): string {
    const stripped = value.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(stripped)) {
      throw new Error('invalid hex value');
    }
    return stripped;
  }

  /**
   * Build a parameterised WHERE clause. `submitterList` items are developer-supplied
   * MySQL hex literals (`x'...'`) and therefore safe to interpolate; every other
   * user-controlled input is bound via `?`.
   */
  private buildWhere(
    timeStart: string,
    timeEnd: string,
    submitterList: string[],
    submitter?: string,
    chainId?: number | string,
  ): { sql: string; params: any[] } {
    const params: any[] = [timeStart, timeEnd];
    let sql = 'gmt_updated >= ? AND gmt_updated <= ?';
    if (submitter) {
      sql += ' AND submitter = UNHEX(?)';
      params.push(this.normalizeHexFilter(submitter));
    }
    if (submitterList.length > 0) {
      sql += ` AND submitter IN (${submitterList.join(',')})`;
    }
    if (chainId !== undefined && chainId !== null) {
      sql += ' AND chain_id = ?';
      params.push(Number(chainId));
    }
    return { sql, params };
  }

  private appendTokenInfo(list: any[], type: 'gas' | 'fee'): number[] {
    const ids: number[] = [];
    for (const item of list) {
      const chain = nativeToken[item.chainId];
      if (!chain) {
        continue;
      }
      const tokenAddress = type === 'gas' ? NATIVE_TOKEN_ADDRESS : item.feeToken;
      const tokenInfo = chain[tokenAddress];
      if (tokenInfo) {
        item.totalGas = `${item.totalGas} ${tokenInfo.symbol}`;
        if (tokenInfo.cid) {
          ids.push(tokenInfo.cid);
          item.cid = tokenInfo.cid;
        }
      } else if (type === 'fee' && tokenAddress && tokenAddress !== NATIVE_TOKEN_ADDRESS) {
        item.totalGas = `${item.totalGas} ${tokenAddress}`;
      }
    }
    return ids;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async insertGasIncomeSpendInfo(): Promise<void> {
    const latestInfo: any = await this.gasIncomeExpenseRepository.findOne({
      where: {},
      order: { relayerId: 'DESC' as any },
    });
    const limit = 1000;
    const relayerId = latestInfo?.relayerId || latestInfo?.id || 0;
    const select = `select id, gmt_updated as gmtUpdated, transaction, chain_id as chainId, submitter, gas_price as gasPrice, gas_limit as gasLimit, status, chain_tx_hash as chainTxHash, discount from relayer_transactions where id > ${relayerId} and status = ${TxStatus.SUCCESS} limit ${limit}`;
    const manager = this.dataSource.manager;
    const relaterTx = await manager.query(select);
    await this.packageAllGasNeedData(relaterTx);
    if (relaterTx.length === limit) {
      await sleep(100);
      await this.insertGasIncomeSpendInfo();
    }
  }

  async queryRelayerTest(sql: string): Promise<any> {
    return this.dataSource.manager.query(sql);
  }

  async packageAllGasNeedData(relaterTxList: any[]): Promise<void> {
    for (const item of relaterTxList) {
      const gasInfo = await this.packageOneGasNeedData(item);
      if (!gasInfo) {
        continue;
      }
      gasInfo.transaction = item.transaction;
      gasInfo.relayerId = item.id;
      await this.insertOneGasIncomeExpenseData(gasInfo);
    }
  }

  async packageOneGasNeedData(item: any): Promise<GasIncomeExpenseRecord | null> {
    item.submitter = this.toHexAddress(item.submitter);
    item.chainTxHash = this.toHexAddress(item.chainTxHash);
    const { chainId, submitter, gasLimit, gasPrice, gmtUpdated, chainTxHash, discount, transaction } = item;
    const chain = nativeToken[item.chainId];
    const decimals = chain?.[NATIVE_TOKEN_ADDRESS]?.decimals ?? 'ether';
    let gasSpent = formatUnits(BigInt(gasLimit) * BigInt(gasPrice), decimals as any);
    const to = transaction?.to;
    const baseInfo: GasIncomeExpenseRecord = { submitter, gmtUpdated, chainId, txHash: chainTxHash, gasLimit, gasPrice, to };
    if (chainId === '2025' || Number(discount) === 0) {
      if (chainId === '2025') {
        gasSpent = '0.0001';
      }
      return { ...baseInfo, feeIncome: '0', feeToken: NATIVE_TOKEN_ADDRESS, gasSpent };
    }
    try {
      const fee = this.relayerService.paseTransaction(item);
      return { ...fee, ...baseInfo, gasSpent };
    } catch (error: any) {
      const apInfo = await this.relayerService.getApTransactionInfo(chainTxHash);
      if (apInfo) {
        return { ...apInfo, ...baseInfo, gasSpent };
      }
      console.error({ error: error?.message, item });
      return null;
    }
  }

  async insertOneGasIncomeExpenseData(gasIncomeExpense: GasIncomeExpenseRecord): Promise<void> {
    const { to } = gasIncomeExpense;
    const account = await this.unipassService.getUniPassUserInfo({ address: to });
    if (account.length > 0) {
      gasIncomeExpense.source = (account[0] as any).source;
    }
    try {
      await this.gasIncomeExpenseRepository.insert(gasIncomeExpense as any);
    } catch (error: any) {
      console.error(error?.message, { txHash: gasIncomeExpense.txHash });
    }
  }

  async getRelayerGasList(input: RelayerGasInput): Promise<PaginatedResult> {
    const { submitter, start, end, page = 1, limit = 10, chainId, isAccountTx } = input;
    const timeStart = start ? String(start) : this.getDateText();
    const timeEnd = end ? String(end) : this.getNextDateText();
    const skip = (Number(page) - 1) * Number(limit);
    const submitterList = await this.getAccountSubmitter(Boolean(isAccountTx));
    const { sql: where, params } = this.buildWhere(timeStart, timeEnd, submitterList, submitter, chainId);
    const select = `select FROM_UNIXTIME(UNIX_TIMESTAMP(gmt_updated),'%Y-%m-%d') as day, chain_id as chainId, submitter, tx_hash as txHash, gas_spent as gasSpent, fee_income as feeIncome, fee_token as feeToken, source, transaction from gas_income_expense where ${where} limit ?, ?`;
    const manager = this.defaultDataSource.manager;
    const list = await manager.query(select, [...params, Number(skip), Number(limit)]);
    const count = await manager.query(`select count(*) as total from gas_income_expense where ${where}`, params);
    for (const item of list) {
      item.submitter = this.toHexAddress(item.submitter);
      item.txHash = this.toHexAddress(item.txHash);
      try {
        const tx = item.transaction;
        const { interactWithAddress, functionAbi } = this.relayerService.paseInteractWith(tx);
        item.interactWithAddress = item.source ? interactWithAddress : ' - ';
        item.functionAbi = functionAbi;
        delete item.transaction;
      } catch (error: any) {
        console.error(error?.message);
      }
      const feeTokenInfo = nativeToken[item.chainId]?.[item.feeToken];
      if (feeTokenInfo) {
        item.feeIncome = `${item.feeIncome} ${feeTokenInfo.symbol}`;
      } else if (item.feeToken !== NATIVE_TOKEN_ADDRESS) {
        item.feeIncome = `${item.feeIncome} ${item.feeToken}`;
      }
      const gasTokenInfo = nativeToken[item.chainId]?.[NATIVE_TOKEN_ADDRESS];
      if (gasTokenInfo) {
        item.gasSpent = `${item.gasSpent} ${gasTokenInfo.symbol}`;
      }
    }
    return { list, pagination: { total: Number(count[0]?.total || 0), size: Number(limit), page: Number(page) } };
  }

  async getIncomeSummary(input: RelayerGasInput): Promise<PaginatedResult> {
    const { gasExpenseList, gasIncomeList, ids, count } = await this.getIncomeExpenseGroupByChainId(input);
    const idToken = await this.getPriceConversion(ids);
    for (const item of gasExpenseList) {
      this.getTokenUsdValue(item, idToken);
    }
    for (const item of gasIncomeList) {
      this.getTokenUsdValue(item, idToken);
    }
    const list = this.getGasDayEarnings(gasExpenseList, gasIncomeList);
    return {
      list,
      pagination: {
        total: Number(count[0]?.total || 0),
        size: Number(count[0]?.total || 0),
        page: Number(input.page || 1),
      },
    };
  }

  getGasDayEarnings(gasExpenseList: any[], gasIncomeList: any[]): any[] {
    const dayMap = new Map<string, Record<string, any>>();
    const dayList: any[] = [];
    for (const item of gasExpenseList) {
      const current = dayMap.get(item.day) || {};
      const chainInfo = current[item.chainId] || { chainId: item.chainId, expense: [], income: [] };
      chainInfo.expense.push(item);
      current[item.chainId] = chainInfo;
      dayMap.set(item.day, current);
    }
    for (const item of gasIncomeList) {
      const current = dayMap.get(item.day) || {};
      const chainInfo = current[item.chainId] || { chainId: item.chainId, expense: [], income: [] };
      chainInfo.income.push(item);
      current[item.chainId] = chainInfo;
      dayMap.set(item.day, current);
    }
    for (const [key, chainInfo] of dayMap.entries()) {
      for (const info of Object.values(chainInfo)) {
        const data = this.getGasEarnings((info as any).expense, (info as any).income);
        dayList.push({ ...data, key, chainId: (info as any).chainId });
      }
    }
    return dayList;
  }

  async getEarningsData(isAccountTx?: boolean): Promise<any> {
    const count = await this.gasIncomeExpenseRepository.count();
    const { gasExpenseList, gasIncomeList, ids } = await this.getIncomeExpenseList({ limit: count, page: 1, start: '2022-11-15' }, isAccountTx);
    const idToken = await this.getPriceConversion(ids);
    for (const item of gasExpenseList) {
      this.getTokenUsdValue(item, idToken);
    }
    for (const item of gasIncomeList) {
      this.getTokenUsdValue(item, idToken);
    }
    return this.getGasEarnings(gasExpenseList, gasIncomeList);
  }

  getGasEarnings(gasExpenseList: any[] = [], gasIncomeList: any[] = []): { totalExpenseUsd: number; totalIncomeUsd: number; gasEarnings: number } {
    let totalExpenseUsd = new Decimal(0);
    let totalIncomeUsd = new Decimal(0);
    for (const item of gasExpenseList) {
      if (item.usd) {
        totalExpenseUsd = totalExpenseUsd.add(new Decimal(item.usd));
      }
    }
    for (const item of gasIncomeList) {
      if (item.usd) {
        totalIncomeUsd = totalIncomeUsd.add(new Decimal(item.usd));
      }
    }
    const gasEarnings = totalIncomeUsd.minus(totalExpenseUsd);
    return { totalExpenseUsd: totalExpenseUsd.toNumber(), totalIncomeUsd: totalIncomeUsd.toNumber(), gasEarnings: gasEarnings.toNumber() };
  }

  getTokenUsdValue(tokenInfo: any, idToken: Record<string, any>): void {
    const cid = tokenInfo.cid;
    const isAP = tokenInfo.feeToken === 'AP';
    if (!cid || isAP) {
      return;
    }
    const usdInfo = idToken[cid];
    const price = usdInfo?.quote?.USD?.price || 0.001;
    const token = String(tokenInfo.totalGas || '0').split(' ')[0];
    tokenInfo.usd = new Decimal(token).mul(new Decimal(price)).toFixed(4);
  }

  async getIncomeExpenseGroupByChainId(input: RelayerGasInput): Promise<{ gasExpenseList: any[]; gasIncomeList: any[]; ids: number[]; count: any[] }> {
    const { start, end, isAccountTx, chainId } = input;
    const timeStart = start ? String(start) : this.getDateText();
    const timeEnd = end ? String(end) : this.getNextDateText();
    const submitterList = await this.getAccountSubmitter(Boolean(isAccountTx));
    if (differenceInCalendarDays(new Date(timeEnd), new Date(timeStart)) > 30) {
      throw new Error('the longest cannot exceed 30 days');
    }
    const { sql: where, params } = this.buildWhere(timeStart, timeEnd, submitterList, undefined, chainId);
    const expenseSelect = `select chain_id AS chainId, FROM_UNIXTIME(UNIX_TIMESTAMP(gmt_updated),'%Y-%m-%d') as day, CAST(SUM(gas_spent) AS DECIMAL(50,10)) AS totalGas from gas_income_expense where ${where} group by chain_id, day order by day desc`;
    const incomeSelect = `select chain_id AS chainId, FROM_UNIXTIME(UNIX_TIMESTAMP(gmt_updated),'%Y-%m-%d') as day, CAST(SUM(fee_income) AS DECIMAL(50,10)) AS totalGas, fee_token AS feeToken from gas_income_expense where ${where} group by chain_id, feeToken, day order by day desc`;
    const expenseCountSelect = `select count(*) as total from (select chain_id AS chainId, FROM_UNIXTIME(UNIX_TIMESTAMP(gmt_updated),'%Y-%m-%d') as day, CAST(SUM(gas_spent) AS DECIMAL(50,10)) AS totalGas from gas_income_expense where ${where} group by chain_id, day) s`;
    const manager = this.defaultDataSource.manager;
    const gasExpenseList = await manager.query(expenseSelect, params);
    const gasIncomeList = await manager.query(incomeSelect, params);
    const count = await manager.query(expenseCountSelect, params);
    const ids = [
      ...this.appendTokenInfo(gasExpenseList, 'gas'),
      ...this.appendTokenInfo(gasIncomeList, 'fee'),
    ];
    return { gasExpenseList, gasIncomeList, ids, count };
  }

  async getIncomeExpenseList(input: Partial<RelayerGasInput>, isAccountTx?: boolean): Promise<{ gasExpenseList: any[]; gasIncomeList: any[]; ids: number[] }> {
    const { submitter, start, end, chainId } = input;
    const timeStart = start ? String(start) : this.getDateText();
    const timeEnd = end ? String(end) : this.getNextDateText();
    const submitterList = await this.getAccountSubmitter(Boolean(isAccountTx));
    const { sql: where, params } = this.buildWhere(timeStart, timeEnd, submitterList, submitter, chainId);
    const expenseSelect = `select chain_id AS chainId, CAST(SUM(gas_spent) AS DECIMAL(50,10)) AS totalGas from gas_income_expense where ${where} group by chain_id`;
    const incomeSelect = `select chain_id AS chainId, CAST(SUM(fee_income) AS DECIMAL(50,10)) AS totalGas, fee_token AS feeToken from gas_income_expense where ${where} group by chain_id, feeToken`;
    const manager = this.defaultDataSource.manager;
    const gasExpenseList = await manager.query(expenseSelect, params);
    const gasIncomeList = await manager.query(incomeSelect, params);
    const ids = [
      ...this.appendTokenInfo(gasExpenseList, 'gas'),
      ...this.appendTokenInfo(gasIncomeList, 'fee'),
    ];
    return { gasExpenseList, gasIncomeList, ids };
  }

  async getAccountSubmitter(isAccountTx?: boolean): Promise<string[]> {
    if (isAccountTx) {
      return [
        "x'90a703e047e25607dfb4697b665630f42f07e395'",
        "x'a4c523eef643a033be9510c53358f71fc4aa2a91'",
        "x'a45308f7caa4a2106456e754dba0117d35acd501'",
        "x'34a790e9af84058de7903da165f467610e798e84'",
        "x'fcb6a5fec943c5f1fc290a59a643524abcb64907'",
        "x'3e8f0c31c63627c127dc11640486b552f2a3400b'",
        "x'9c4a82a031f2a37c85df54740a5f0c1582c2f46b'",
        "x'43d4f1c717d978387ceeb2d0640e14e5bb07fd7e'",
        "x'386b305571f65a55d273805b656615875c252cd4'",
        "x'fa345abf2702715a2489ddb964ff3fdb00996754'",
        "x'a6864b1d6fe9f3dcbd5cf734a3c02d911f34abb5'",
        "x'2db3471dc6da9dee636347da463909269a10f740'",
        "x'5c1ea2cffebb97ff358814174535362b292c83a9'",
        "x'5bc0dba2dbe82311f7888de699d24e5f312b953d'",
        "x'e78cb0992b999f48b095cd220fd0a182dfd0907b'",
      ];
    }
    return [
      "x'9838abdeb878e96e0eb0412a29bcd97e681b30c5'",
      "x'1f3a19079fda5faeb0afab2c0a4180402798fa5b'",
      "x'56e19829f7231deb3636af39dbcd709d12f58ccd'",
      "x'ffd87bcdc3dc92c291b29fa85ef4d0cc46b2ae93'",
      "x'd378503bb096c71e91cff29eecaa7c5c7f7697ee'",
      "x'1a8fdbd35aa897ada93d78179e5328f50e01c783'",
      "x'9ff3b6d65bb640421bb289b5ebd8105d9bd8d0f7'",
      "x'41748bca5276f44d4dbd9a650dbbc029c0e372e0'",
      "x'b513b65ab0ac30439a19a83c6dd52d20f9224b88'",
      "x'a2ce88c9233a9d43f5663e554886b47d9aa0f5f5'",
      "x'5b445b10f8fac324afc3be354af9540bdd256d7c'",
      "x'9e35fb982f8e1a8396f9e4091071431fb229533a'",
      "x'c2900c3242f2ad1283da6b5bcc2b1f60581a2c0d'",
      "x'2796250ef0413189900c9221a400c1eb92b1530b'",
      "x'2582b52e68d363fcb680c1dfb82e026fdabe8250'",
    ];
  }

  async getPriceConversion(ids: number[]): Promise<any> {
    const tokenData: Record<string, any> = {};
    const queryIds: number[] = [];
    for (const item of ids) {
      const idKey = `admin:price:${item}`;
      const idTokenCache = await this.redisService.getRedis().get(idKey);
      if (idTokenCache) {
        tokenData[item] = JSON.parse(idTokenCache);
      } else {
        queryIds.push(item);
      }
    }
    if (queryIds.length === 0) {
      return tokenData;
    }
    const id = queryIds.join(',');
    const key = `price_${id}`;
    const priceCache = await this.redisService.getRedis().get(key);
    if (priceCache) {
      return JSON.parse(priceCache);
    }
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${id}`;
    const config = { headers: { 'X-CMC_PRO_API_KEY': this.apiConfigService.cmcConfig.key } };
    const reqData = await this.upHttpService.httpGet(url, config);
    if (!reqData) {
      return {};
    }
    const data = reqData.data;
    for (const keyId in data) {
      const idKey = `price_${keyId}`;
      await this.redisService.getRedis().set(idKey, JSON.stringify(data[keyId]), 'EX', 60 * 10);
    }
    await this.redisService.getRedis().set(key, JSON.stringify(data), 'EX', 60 * 10);
    return data;
  }
}
