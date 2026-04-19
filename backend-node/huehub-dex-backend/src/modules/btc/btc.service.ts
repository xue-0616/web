import { Cron } from '@nestjs/schedule';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BtcChainInfoOutput, BtcGasFeeInfo } from './dto/chain.info.dto';
import { MyHttpService } from '../../common/utils-service/http.service';
import { BtcRbf, UsdPrice, UtxoSpendInfo } from '../../common/interface/mempool.dto';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { RgbppDistributorService } from '../ckb/rgbpp-distributor.service';
import { RedlockService } from '../../common/utils-service/redlock.service';
import Decimal from 'decimal.js';
import { TIME } from '../../common/utils/const.config';
import { StatusName } from '../../common/utils/error.code';

@Injectable()
export class BtcService {
    constructor(private readonly logger: AppLoggerService, private readonly myHttpService: MyHttpService, private readonly rgbppDistributorService: RgbppDistributorService, @InjectRedis() private readonly redis: Redis, private readonly appConfig: AppConfigService, private readonly redlockService: RedlockService) {
        this.logger.setContext(BtcService.name);
        this.updateChainInfo();
    }
    getChainInfoKey(info: any) {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Btc:Chain:Info:${info}{tag}`;
        }
    async getBtcPrice(): Promise<UsdPrice> {
            let key = this.getChainInfoKey('prices');
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let price = await this.updateBtcPrice();
            if (price) {
                return price;
            }
            return { USD: 0 };
        }
    async updateBtcPrice(): Promise<UsdPrice | null> {
            let key = this.getChainInfoKey('prices');
            let price = await this.getBinanceBtcPrice();
            if (!price || price.USD <= 0) {
                price = await this.getMempoolBtcPrice();
            }
            if (!price) {
                price = await this.getOdosBtcPrice();
            }
            if (!price) {
                price = await this.getCmcBtcPrice();
            }
            if (!price) {
                this.logger.error('get USD price error');
                return null;
            }
            this.logger.log(`[updateBtcPrice] btcPrice updated ${price.USD}`);
            if (price) {
                await this.redis.set(key, JSON.stringify(price), 'EX', TIME.HALF_HOUR * 24);
            }
            return price;
        }
    async getBinanceBtcPrice(): Promise<UsdPrice | null> {
            let url = `https://data-api.binance.vision/api/v3/avgPrice?symbol=BTCUSDT`;
            try {
                let data = await this.myHttpService.httpGet(url);
                if (data) {
                    return {
                        USD: Number(data.price),
                    };
                }
                else {
                    throw new Error('Get Binance API failed');
                }
            }
            catch (error) {
                this.logger.error(`[error] getBinanceBtcPrice ${(error as Error)?.stack}`);
                return null;
            }
        }
    async getMempoolBtcPrice(): Promise<UsdPrice | null> {
            let url = `https://mempool.space/api/v1/prices`;
            try {
                let data = await this.myHttpService.httpGet(url);
                return data;
            }
            catch (error) {
                this.logger.error(`[error]${(error as Error)?.stack}`);
                return null;
            }
        }
    async getOdosBtcPrice(): Promise<UsdPrice | null> {
            let url = `https://odos.network/coincap/assets/bitcoin`;
            try {
                let data = await this.myHttpService.httpGet(url);
                return { USD: new Decimal(data.data.priceUsd).toNumber() };
            }
            catch (error) {
                this.logger.error(`[error]${(error as Error)?.stack}`);
                return null;
            }
        }
    async getCmcBtcPrice(): Promise<UsdPrice | null> {
            let url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=1&CMC_PRO_API_KEY=${this.appConfig.cmcApiKey}`;
            try {
                let data = await this.myHttpService.httpGet(url);
                return { USD: data.data[1].quote.USD.price };
            }
            catch (error) {
                this.logger.error(`[error]${(error as Error)?.stack}`);
                return null;
            }
        }
    async getBlockHeigh(): Promise<number> {
            let key = this.getChainInfoKey('height');
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return Number(cacheData);
            }
            let blockHeight = await this.updateBlockHeight();
            return blockHeight;
        }
    async updateBlockHeight(): Promise<any> {
            let key = this.getChainInfoKey('height');
            let mempoolBlockHeightUrl = `${this.appConfig.rgbPPConfig.electrsUrl}/blocks/tip/height`;
            let blockHeight = await this.myHttpService.httpGet(mempoolBlockHeightUrl);
            await this.redis.set(key, blockHeight.toString(), 'EX', TIME.HALF_HOUR * 24);
            return blockHeight;
        }
    async getFees(): Promise<BtcGasFeeInfo> {
            let key = this.getChainInfoKey('recommended');
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let gasFeeInfo = await this.updateFees();
            if (!gasFeeInfo) {
                throw new Error('get fee error');
            }
            return gasFeeInfo;
        }
    async updateFees(): Promise<BtcGasFeeInfo | null> {
            let key = this.getChainInfoKey('recommended');
            let gasFeeInfo = await this.getMempoolFees();
            if (!gasFeeInfo) {
                return null;
            }
            await this.redis.set(key, JSON.stringify(gasFeeInfo), 'EX', TIME.HALF_HOUR * 24);
            return gasFeeInfo;
        }
    async getMempoolFees(): Promise<BtcGasFeeInfo | null> {
            let mempoolFeesUrl = `${this.appConfig.rgbPPConfig.mempoolUrl}/api/v1/fees/recommended`;
            try {
                let fees = await this.myHttpService.httpGet(mempoolFeesUrl);
                this.logger.log(`[getMempoolFees] fees  ${JSON.stringify(fees)}`);
                if (fees) {
                    if (fees['hourFee'] == 10 &&
                        fees['halfHourFee'] == 11 &&
                        fees['fastestFee'] == 11) {
                        this.logger.warn(`[getMempoolFees] return value exception  ${JSON.stringify(fees)}`);
                        return null;
                    }
                    let gasFeeInfo = {
                        slow: new Decimal(fees['hourFee']).ceil().toNumber(),
                        standard: new Decimal(fees['halfHourFee']).ceil().toNumber(),
                        fast: new Decimal(fees['fastestFee']).ceil().toNumber(),
                    };
                    return gasFeeInfo;
                }
                return null;
            }
            catch (error) {
                this.logger.error(`[error]${(error as Error)?.stack}`);
                return null;
            }
        }
    async getElectrsFees(): Promise<BtcGasFeeInfo | null> {
            let mempoolFeesUrl = `${this.appConfig.rgbPPConfig.electrsUrl}/fee-estimates`;
            let fees = await this.myHttpService.httpGet(mempoolFeesUrl);
            let gasFeeInfo = {
                slow: new Decimal(fees[1]).ceil().toNumber(),
                standard: new Decimal(fees[2]).ceil().toNumber(),
                fast: new Decimal(fees[3]).ceil().toNumber(),
            };
            return gasFeeInfo;
        }
    async getBtcChainInfo(): Promise<BtcChainInfoOutput> {
            try {
                let [prices, blockHeight, gas, paymasterBalance] = await Promise.all([
                    this.getBtcPrice(),
                    this.getBlockHeigh(),
                    this.getFees(),
                    this.rgbppDistributorService.getDistributorCKBBalance(),
                ]);
                return {
                    gas,
                    usdPrice: prices.USD,
                    blockHeight,
                    paymasterBalance: new Decimal(1),
                };
            }
            catch (error) {
                this.logger.error(`[error]${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
        }
    async getTxidRbf(txid: string): Promise<BtcRbf> {
            let url = `${this.appConfig.rgbPPConfig.mempoolUrl}/api/v1/tx/${txid}/rbf`;
            let brf = await this.myHttpService.httpGet(url);
            return brf;
        }
    async checkUtxoStatusAndOwnership(address: string, txid: string, vout: number): Promise<any> { }
    updateChainInfoCacheKey() {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Task:UpdateChainInfo:{tag}`;
        }
    @Cron('0 */1 * * * *')
    async updateChainInfo(): Promise<void> {
            const key = this.updateChainInfoCacheKey();
            const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
            if (lock) {
                this.logger.log('[updateChainInfo] task start');
                try {
                    this.logger.log(`[updateChainInfo] start updateChainInfo`);
                    await this.updateBlockHeight();
                    await this.updateBtcPrice();
                    await this.updateFees();
                }
                catch (error) {
                    this.logger.error(`[updateChainInfo] job: ${(error as Error).message}}`);
                }
                finally {
                    await this.redlockService.releaseLock(lock);
                }
            }
            else {
                this.logger.log('[updateChainInfo] task is already running on another instance');
            }
        }
    async getSpendingStatus(txid: string, vout: number): Promise<UtxoSpendInfo> {
            let url = `${this.appConfig.rgbPPConfig.electrsUrl}/tx/${txid}/outspend/${vout}`;
            let utxoSpendInfo = await this.myHttpService.httpGet(url);
            return utxoSpendInfo;
        }
}
