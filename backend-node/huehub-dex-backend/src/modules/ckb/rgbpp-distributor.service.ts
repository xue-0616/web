import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import Decimal from 'decimal.js';
import { Collector } from '@rgbpp-sdk/ckb';
import { addressToScript } from '@nervosnetwork/ckb-sdk-utils';

@Injectable()
export class RgbppDistributorService {
    constructor(private readonly logger: AppLoggerService, @InjectRedis() private readonly redis: Redis, private readonly appConfig: AppConfigService) {
        this._collector = new Collector({
            ckbNodeUrl: this.appConfig.rgbPPConfig.ckbNodeUrl,
            ckbIndexerUrl: this.appConfig.rgbPPConfig.ckbIndexerUrl,
        });
        this._distributorAddress =
            this.appConfig.rgbPPConfig.distributorTimeLockCkbAddress;
    }
    private _collector: any;
    private _distributorAddress: any;
    async getDistributorCKBBalance(): Promise<Decimal> {
            const balanceKey = `${this.appConfig.nodeEnv}:Hue:Hub:Ckb:Distributor:Balance:${this._distributorAddress}{tag}`;
            let balanceStr = await this.redis.get(balanceKey);
            if (balanceStr) {
                return new Decimal(balanceStr);
            }
            const cells = await this._collector.getCells({
                lock: addressToScript(this._distributorAddress),
            });
            const balance = cells
                .map((x: any) => new Decimal(x.output.capacity))
                .reduce((sum: any, val: any) => sum.add(val), new Decimal(0));
            await this.redis.setex(balanceKey, 10, balance.toString());
            return balance;
        }
}
