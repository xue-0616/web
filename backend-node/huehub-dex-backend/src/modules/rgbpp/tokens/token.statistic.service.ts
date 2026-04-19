import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenEntity } from '../../../database/entities/token.entity';
import { TokenStatisticEntity } from '../../../database/entities/token.statistic.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import Redis from 'ioredis';
import { RgbPPIndexerService } from '../indexer.service';
import { ItemService } from '../order/item.service';
import { TokenStatisticInfo } from '../dto/tokens-statistic.output.dto';
import { ItemFloorPrice, ItemStatistic } from '../../../common/interface/statistic';
import { UsdPrice } from '../../../common/interface/mempool.dto';
import { IndexerTokenInfoList } from '../dto/rgbpp.indexer.dto';
import Decimal from 'decimal.js';
import { StatusName } from '../../../common/utils/error.code';
import { TIME } from '../../../common/utils/const.config';
import moment from 'moment';

@Injectable()
export class TokenStatisticService {
    constructor(private readonly appConfig: AppConfigService, private readonly rgbPpIndexerService: RgbPPIndexerService, private readonly itemService: ItemService, readonly dataSource: DataSource, @InjectRedis() private readonly redis: Redis, private readonly logger: AppLoggerService, @InjectRepository(TokenEntity) private tokenRepository: Repository<TokenEntity>, @InjectRepository(TokenStatisticEntity) private tokenStatisticRepository: Repository<TokenStatisticEntity>) {
        this.logger.setContext(TokenStatisticService.name);
    }
    async insertToken(entity: TokenEntity): Promise<TokenEntity | null> {
            return await this.tokenRepository.save(entity);
        }
    async updateTokenInfoAndStatisticsToken(entity: TokenEntity, statistics: ItemStatistic[], floorItems: ItemFloorPrice[], btcPrice: UsdPrice, statisticFrom24HoursAgoList: TokenStatisticEntity[]): Promise<void> {
            let lastStatics = statistics.find((x) => x.tokenId === entity.id.toString());
            let floorItem = floorItems.find((x) => x.tokenId === entity.id.toString());
            let statisticFrom24HoursAgo = statisticFrom24HoursAgoList.find((x) => x.tokenId === entity.id);
            let tokenInfo = await this.rgbPpIndexerService.getTokens(entity.xudtTypeHash);
            this.updateStatisticsInfo(entity, btcPrice, lastStatics, floorItem, tokenInfo, statisticFrom24HoursAgo);
        }
    async initStatisticsToken(entity: TokenEntity, statistics: ItemStatistic[], statisticFrom24HoursAgoList: TokenStatisticEntity[], floorItems: ItemFloorPrice[]): Promise<void> {
            let statistic = statistics.find((x) => x.tokenId === entity.id.toString());
            let statisticFrom24HoursAgo = statisticFrom24HoursAgoList.find((x) => x.tokenId === entity.id);
            let floorItem = floorItems.find((x) => x.tokenId === entity.id.toString());
            let lastVolume = new Decimal(statistic ? (statistic.totalVolume ? statistic.totalVolume : 0) : 0).minus(new Decimal(statisticFrom24HoursAgo ? statisticFrom24HoursAgo.volume : 0));
            entity.updatedAt = new Date();
            entity.lastVolume = lastVolume;
            entity.lastSales = new Decimal(statistic ? (statistic.salesCount ? statistic.salesCount : 0) : 0);
            entity.floorPrice = new Decimal(floorItem ? floorItem.pricePerToken : 0);
            entity.marketCap = entity.totalSupply
                .div(Decimal.pow(10, entity.decimals))
                .mul(entity.floorPrice);
            entity.updatedAt = new Date();
            await this.tokenRepository.save(entity);
        }
    async updateStatisticsInfo(entity: TokenEntity, btcPrice: UsdPrice, statistic: ItemStatistic | undefined, floorItems: ItemFloorPrice | undefined, tokenInfo: IndexerTokenInfoList | null, statisticFrom24HoursAgo: TokenStatisticEntity | undefined): Promise<void> {
            if (!tokenInfo || tokenInfo.list.length === 0) {
                this.logger.warn(`[updateStatisticsInfo] api /api/v1/rgbpp/tokens not find token info xudtTypeHash is ${entity.xudtTypeHash}`);
                return;
            }
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let lastVolume = new Decimal(statistic ? (statistic.totalVolume ? statistic.totalVolume : 0) : 0).minus(new Decimal(statisticFrom24HoursAgo ? statisticFrom24HoursAgo.volume : 0));
                entity.lastHolders = new Decimal(tokenInfo.list[0].holders);
                entity.updatedAt = new Date();
                entity.lastVolume = lastVolume;
                entity.lastSales = new Decimal(statistic ? (statistic.salesCount ? statistic.salesCount : 0) : 0);
                entity.floorPrice = new Decimal(floorItems ? floorItems.pricePerToken : 0);
                entity.marketCap = entity.totalSupply
                    .div(Decimal.pow(10, entity.decimals))
                    .mul(entity.floorPrice);
                await manager.save(entity);
                let now = moment();
                let nearestTenMinutes = Math.round(now.minutes() / 5) * 5;
                now.minutes(nearestTenMinutes);
                now.seconds(0);
                now.milliseconds(0);
                let statisticEntity = new TokenStatisticEntity();
                statisticEntity.tokenId = entity.id;
                statisticEntity.time = now.unix();
                statisticEntity.sales = new Decimal(statistic ? (statistic.salesCount ? statistic.salesCount : 0) : 0);
                statisticEntity.holders = entity.lastHolders;
                statisticEntity.floorPrice = new Decimal(floorItems ? floorItems.pricePerToken : 0);
                statisticEntity.btcUsdPrice = new Decimal(btcPrice.USD);
                statisticEntity.volume = new Decimal(statistic ? (statistic.totalVolume ? statistic.totalVolume : 0) : 0);
                statisticEntity.marketCap = entity.totalSupply
                    .div(Decimal.pow(10, entity.decimals))
                    .mul(statisticEntity.floorPrice);
                statisticEntity.createdAt = now.toDate();
                statisticEntity.updatedAt = now.toDate();
                await manager.save(statisticEntity);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[updateStatisticsInfo] ${(error as Error)?.stack} tokenInfo ${JSON.stringify(tokenInfo)}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            this.logger.log(`[updateStatisticsInfo] ${entity.id}`);
        }
    async queryTokenStatistics(startTime: number, endTime: number, token: TokenEntity): Promise<TokenStatisticEntity[]> {
            const rawQuery = `
        WITH statistics AS (
            SELECT
                *,
                ROW_NUMBER() OVER (ORDER BY statistics.time ASC) AS rn_asc,
                ROW_NUMBER() OVER (ORDER BY statistics.time DESC) AS rn_desc
            FROM
            token_statistics statistics
            WHERE
                statistics.time BETWEEN ? AND ?
            AND statistics.token_id = ?
        )
        SELECT * FROM statistics WHERE rn_asc = 1 OR rn_desc = 1 ORDER BY rn_desc desc;
    `;
            const parameters = [startTime, endTime, token.id];
            const statisticsList = await this.tokenStatisticRepository.query(rawQuery, parameters);
            const tokenStatistics = statisticsList.map((stat: any) => {
                const entity = new TokenStatisticEntity();
                entity.tokenId = parseInt(stat.token_id, 10);
                entity.sales = new Decimal(stat.sales);
                entity.holders = new Decimal(stat.holders);
                entity.volume = new Decimal(stat.volume);
                entity.floorPrice = new Decimal(stat.floor_price);
                entity.btcUsdPrice = new Decimal(stat.btc_usd_price);
                entity.marketCap = new Decimal(stat.market_cap);
                entity.time = parseInt(stat.time, 10);
                entity.createdAt = stat.created_at;
                entity.updatedAt = stat.updated_at;
                return entity;
            });
            return tokenStatistics;
        }
    async getTokenInfo(where: FindOptionsWhere<TokenEntity>): Promise<TokenEntity | null> {
            return await this.tokenRepository.findOne({ where });
        }
    async findTokenEntities(where: FindOptionsWhere<TokenEntity>): Promise<TokenEntity[]> {
            return await this.tokenRepository.find({ where });
        }
    async getLastTokenStatistic(where: FindOptionsWhere<TokenStatisticEntity>): Promise<TokenStatisticEntity | null> {
            return await this.tokenStatisticRepository.findOne({
                where,
                order: {
                    time: 'DESC',
                },
            });
        }
    async getTokenEntityByIdOrTypeHash(tokenId: number, xudtTypeHash: string): Promise<TokenEntity | null> {
            if (!tokenId && !xudtTypeHash) {
                this.logger.error('[getTokenEntityByIdOrTypeHash] tokenId and xudtTypeHash not find');
                throw new BadRequestException(StatusName.ParameterException);
            }
            let where = tokenId ? { id: tokenId } : { xudtTypeHash };
            let tokenInfo = await this.getTokenInfo(where);
            if (!tokenInfo) {
                this.logger.error('token info not find');
                throw new BadRequestException(StatusName.ParameterException);
            }
            return tokenInfo;
        }
    async getTokenStaticsList(tokenId: number, startTime: number, endTime: number): Promise<TokenStatisticInfo[]> {
            const totalIntervals = (endTime - startTime) / (5 * 60);
            const step = Math.ceil(totalIntervals / 30);
            const query = `
        SELECT
          floor_price as floorPrice,
          volume,
          time,
          (@rownum := @rownum + 1) AS rownum
          FROM
            token_statistics,
            (SELECT @rownum := 0) r
          WHERE
            token_id = ? AND
            time BETWEEN ? AND ?
        HAVING
          rownum % ? = 0
          ORDER BY
            time ASC;
      `;
            const parameters = [tokenId, startTime, endTime, step];
            const rawStatistics = await this.tokenStatisticRepository.query(query, parameters);
            return rawStatistics.map((x: any) => {
                return {
                    price: new Decimal(x.floorPrice),
                    volume: new Decimal(x.volume),
                    time: x.time,
                };
            });
        }
    getTokenStatisticCacheKey(tokenIds: number[]): string {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Tokens:${tokenIds.join('_')}{tag}`;
        }
    async getStatisticFrom24HoursAgo(tokenIds: number[], filterFloorPrices?: boolean): Promise<TokenStatisticEntity[]> {
            if (tokenIds.length == 0) {
                return [];
            }
            const key = this.getTokenStatisticCacheKey(tokenIds);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            const startTime = moment().subtract(1, 'day').unix();
            const endTime = moment().unix();
            let statistics = await Promise.all(tokenIds.map((tokenId) => {
                let builder = this.tokenStatisticRepository
                    .createQueryBuilder('statistic')
                    .where('statistic.time BETWEEN :startTime AND :endTime AND statistic.tokenId = :tokenId', { startTime, endTime, tokenId });
                if (filterFloorPrices) {
                    builder.andWhere('statistic.floorPrice > :zero', { zero: 0 });
                }
                return builder.orderBy('statistic.time').limit(1).getOne();
            }));
            const filtered: TokenStatisticEntity[] = statistics.filter((statistic): statistic is TokenStatisticEntity => statistic !== null && statistic !== undefined);
            await this.redis.set(key, JSON.stringify(filtered), 'EX', TIME.ONE_MINUTES);
            return filtered;
        }
    async getTokenStatisticList(where: FindOptionsWhere<TokenStatisticEntity>): Promise<TokenStatisticEntity[]> {
            return await this.tokenStatisticRepository.find({ where });
        }
    async updateTokenStatics(tokenStatisticEntity: TokenStatisticEntity, tokenEntity: TokenEntity): Promise<TokenStatisticEntity | null> {
            if (tokenStatisticEntity.floorPrice.toNumber() > 0) {
                this.logger.log(`[updateTokenStatics]. okenStatisticEntity.floorPrice !== 0 ${tokenStatisticEntity.time}`);
                return null;
            }
            try {
                let item = await this.itemService.fixMinimalFloorPriceItem(tokenStatisticEntity.tokenId, tokenStatisticEntity.time);
                if (!item) {
                    this.logger.log(`[updateTokenStatics]. item not find floorPrice ${tokenStatisticEntity.floorPrice}tokenStatisticEntity.id = ${tokenStatisticEntity.time}`);
                    return null;
                }
                tokenStatisticEntity.floorPrice = item.pricePerToken;
                tokenStatisticEntity.marketCap = tokenEntity.totalSupply
                    .div(Decimal.pow(10, tokenEntity.decimals))
                    .mul(tokenStatisticEntity.floorPrice);
                this.logger.log(`[updateTokenStatics]. floorPrice ${tokenStatisticEntity.floorPrice}item.id = ${item.id}`);
                tokenStatisticEntity =
                    await this.tokenStatisticRepository.save(tokenStatisticEntity);
                return tokenStatisticEntity;
            }
            catch (error) {
                this.logger.error(`[updateTokenStatics]. ${error}`);
            }
            return tokenStatisticEntity;
        }
    async updateTokenFloorPrice(tokenEntity: TokenEntity): Promise<void> {
            try {
                let floorItems = await this.itemService.getAllMinimalFloorPriceItem([
                    tokenEntity.id,
                ]);
                const update = {
                    floorPrice: new Decimal(floorItems.length > 0 ? floorItems[0].pricePerToken : 0),
                    marketCap: tokenEntity.totalSupply
                        .div(Decimal.pow(10, tokenEntity.decimals))
                        .mul(tokenEntity.floorPrice),
                    updatedAt: new Date(),
                };
                await this.tokenRepository.update(tokenEntity.id, update);
                this.logger.log(`[updateTokenFloorPrice] update: id:${tokenEntity.id} ${JSON.stringify(update)}}`);
            }
            catch (error) {
                this.logger.error(`[updateTokenFloorPrice] error: ${(error as Error)?.stack}}`);
            }
        }
}
