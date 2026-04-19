import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { CollectionType, CollectionsInfoInput, CollectionsInput } from './dto/collections.input.dto';
import { CollectionInfoDto, CollectionOutputDto } from './dto/collections.output.dto';
import { CollectionDbService, StatisticDbService } from './db.service';
import { CollectionEntity, DobsStatus, StatisticEntity } from '../../database/entities';
import { BtcService } from '../btc/btc.service';
import { UsdPrice } from '../../common/interface/mempool.dto';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import Decimal from 'decimal.js';
import { TIME } from '../../common/utils/const.config';
import { convertTokenPriceToUSDPrice } from '../../common/utils/tools';
import { StatusName } from '../../common/utils/error.code';

@Injectable()
export class CollectionService {
    constructor(private readonly logger: AppLoggerService, private readonly btcService: BtcService, private readonly collectionDbService: CollectionDbService, private readonly statisticDbService: StatisticDbService, private readonly appConfigService: AppConfigService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(CollectionService.name);
    }
    collectionsCacheKey(collectionType: CollectionType, page: number, limit: number): string {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Dobs:${collectionType}_${page}_${limit}{tag}`;
        }
    collectionsInfoCacheKey(clusterTypeHash: string): string {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Dobs:${clusterTypeHash}{tag}`;
        }
    async collections(query: CollectionsInput): Promise<CollectionOutputDto> {
            let { page, limit, collectionType } = query;
            const key = this.collectionsCacheKey(collectionType, page, limit);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let [usdPrice, collections] = await Promise.all([
                this.btcService.getBtcPrice(),
                this.collectionDbService.find({
                    status: DobsStatus.Listing,
                }, page * limit, limit),
            ]);
            let collectionIds = collections.map((collection) => collection.id);
            let statisticList = [];
            statisticList = await this.statisticDbService.getStatisticFrom24HoursAgo(collectionIds, true);
            let list = await Promise.all(collections.map(async (collection) => {
                let statistic = statisticList.find((statistic) => statistic.collectionId === collection.id);
                return this.packageCollectionInfo(collection, usdPrice, statistic);
            }));
            if (list.length > 0) {
                await this.redis.set(key, JSON.stringify(list), 'EX', TIME.TEN_SECOND);
            }
            return { list };
        }
    initCollectionInfo(collection: any, usdPrice: any) {
            let btcPriceInUsd = new Decimal(usdPrice.USD);
            let data = {
                id: collection.id,
                iconUrl: collection.iconUrl,
                name: collection.name,
                clusterTypeHash: `0x${collection.clusterTypeHash}`,
                clusterTypeArgs: `0x${collection.clusterTypeArgs}`,
                decimal: collection.decimals,
                supply: collection.totalSupply,
                holders: collection.lastHolders,
                price: collection.floorPrice,
                usdPrice: convertTokenPriceToUSDPrice(btcPriceInUsd, collection.floorPrice).toFixed(4),
                volume: collection.lastVolume,
                usdVolume: convertTokenPriceToUSDPrice(btcPriceInUsd, collection.lastVolume).toFixed(4),
                marketCap: collection.marketCap,
                usdMarketCap: convertTokenPriceToUSDPrice(btcPriceInUsd, collection.marketCap).toFixed(4),
                sales: collection.lastSales,
                change: '0',
                holdersChange: '0',
            };
            return data;
        }
    async packageCollectionInfo(collection: CollectionEntity, usdPrice: UsdPrice, statistic: StatisticEntity | undefined): Promise<CollectionInfoDto> {
            let data = this.initCollectionInfo(collection, usdPrice);
            if (statistic) {
                data.change = data.price
                    .minus(statistic.floorPrice)
                    .div(statistic.floorPrice)
                    .toFixed(8);
                data.holdersChange = data.holders
                    .minus(statistic.holders)
                    .div(statistic.holders)
                    .toFixed(8);
            }
            return data;
        }
    async collectionInfo(query: CollectionsInfoInput): Promise<CollectionInfoDto> {
            let { clusterTypeHash } = query;
            const key = this.collectionsInfoCacheKey(clusterTypeHash);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let [usdPrice, collection] = await Promise.all([
                this.btcService.getBtcPrice(),
                this.collectionDbService.findOne({
                    clusterTypeHash,
                    status: DobsStatus.Listing,
                }),
            ]);
            if (!collection) {
                this.logger.error(`[collectionInfo] ${clusterTypeHash} not find `);
                throw new BadRequestException(StatusName.ParameterException);
            }
            let statistic = await this.statisticDbService.getLastTokenStatistic({
                collectionId: collection.id,
            });
            let info = this.initCollectionInfo(collection, usdPrice);
            if (statistic) {
                info.volume = statistic.volume;
            }
            await this.redis.set(key, JSON.stringify(info), 'EX', TIME.TEN_SECOND);
            return info;
        }
    async queryOneCollection(clusterTypeHash: string | null, collectionId?: number, updateFloorPrice?: boolean): Promise<CollectionEntity> {
            const where = clusterTypeHash
                ? {
                    clusterTypeHash,
                    status: DobsStatus.Listing,
                }
                : {
                    id: collectionId,
                    status: DobsStatus.Listing,
                };
            const collection = await this.collectionDbService.findOne(where);
            if (!collection) {
                this.logger.error(`[collectionInfo] ${clusterTypeHash} not find `);
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (updateFloorPrice) {
                await this.collectionDbService.updateCollectionFloorPrice(collection);
            }
            return collection;
        }
}
