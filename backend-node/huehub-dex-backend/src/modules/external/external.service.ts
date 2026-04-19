import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { RgbPPIndexerService } from '../rgbpp/indexer.service';
import { SnapshotInputDto } from './dto/snapshot.input.dto';
import { SnapshotOutputDto } from './dto/snapshot.output.dto';
import { TokenStatisticService } from '../rgbpp/tokens/token.statistic.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { StatusName } from '../../common/utils/error.code';
import { TIME } from '../../common/utils/const.config';

@Injectable()
export class ExternalService {
    constructor(private readonly appConfig: AppConfigService, private readonly logger: AppLoggerService, private readonly rgbPpIndexer: RgbPPIndexerService, private readonly tokenStatisticService: TokenStatisticService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(ExternalService.name);
    }
    getSnapshotCacheKey(xudtTypeHash: string): string {
            return `${this.appConfig.nodeEnv}:Hue:Hub:External:Snapshot:${xudtTypeHash}{tag}`;
        }
    async assetSnapshot(input: SnapshotInputDto): Promise<SnapshotOutputDto> {
            const { xudtTypeHash } = input;
            const key = this.getSnapshotCacheKey(xudtTypeHash);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let tokenInfo = await this.tokenStatisticService.getTokenInfo({
                xudtTypeHash: xudtTypeHash.replace('0x', ''),
            });
            if (!tokenInfo) {
                this.logger.error('[assetSnapshot] tokenInfo not find');
                throw new BadRequestException(StatusName.ParameterException);
            }
            let indexerTokenInfoList = await this.rgbPpIndexer.getTokens(xudtTypeHash);
            if (!indexerTokenInfoList || indexerTokenInfoList.list.length == 0) {
                this.logger.error('[assetSnapshot] indexer getTokens not find');
                throw new BadRequestException(StatusName.ParameterException);
            }
            let indexerToken = indexerTokenInfoList.list[0];
            let holdersCount = indexerToken.holders;
            let holders = await this.rgbPpIndexer.getTokenHolders(xudtTypeHash, 0, Number(holdersCount));
            let list: any[] = [];
            if (holders) {
                for (let holder of holders.list) {
                    list.push({
                        address: holder.address,
                        amount: holder.amount,
                    });
                }
            }
            if (!holders) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            let data = {
                list,
                tokenInfo: {
                    xudtTypeHash: tokenInfo.xudtTypeHash,
                    holders: list.length.toString(),
                    decimal: tokenInfo.decimals,
                    symbol: tokenInfo.symbol,
                    name: tokenInfo.name,
                    icon: tokenInfo.name,
                },
                btcBlockHeight: holders.btcBlockHeight,
                ckbBlockHeight: holders.ckbBlockHeight,
            };
            await this.redis.set(key, JSON.stringify(data), 'EX', TIME.TEN_SECOND);
            return data;
        }
}
