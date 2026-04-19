import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { MyHttpService } from '../../common/utils.service/http.service';
import { UsdPrice, UtxoSpendInfo, UtxoTransacrtion } from '../../common/interface/mempool.dto';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import { toCamelcase } from '@rgbpp-sdk/ckb';

@Injectable()
export class BtcService {
    constructor(private readonly logger: AppLoggerService, private readonly myHttpService: MyHttpService, @InjectRedis() private readonly redis: Redis, private readonly appConfig: AppConfigService) {
        this.logger.setContext(BtcService.name);
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
            return { USD: 0 };
        }
    async getSpendingStatus(txid: string, vout: number): Promise<UtxoSpendInfo> {
            let url = `${this.appConfig.rgbPPConfig.electrsUrl}/tx/${txid}/outspend/${vout}`;
            let utxoSpendInfo = await this.myHttpService.httpGet(url);
            return utxoSpendInfo;
        }
    async getTransaction(txid: string): Promise<UtxoTransacrtion | null> {
            let url = `${this.appConfig.rgbPPConfig.mempoolUrl}/api/tx/${txid}`;
            let rawData = await this.myHttpService.httpGet(url);
            if (rawData) {
                return toCamelcase(rawData);
            }
            return null;
        }
}
