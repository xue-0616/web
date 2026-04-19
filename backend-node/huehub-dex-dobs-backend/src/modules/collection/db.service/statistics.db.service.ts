import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CollectionEntity, StatisticEntity } from '../../../database/entities';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { AppLoggerService } from '../../../common/utils.service/logger.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../../common/utils.service/app.config.services';
import { UsdPrice } from '../../../common/interface/mempool.dto';
import { DobsStatistic, ItemFloorPrice, ItemStatistic } from '../../../common/interface/statistic';
import Decimal from 'decimal.js';
import { TIME } from '../../../common/utils/const.config';
import moment from 'moment';

@Injectable()
export class StatisticDbService {
    constructor(private readonly appConfigService: AppConfigService, private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(StatisticEntity) private readonly statisticRepository: Repository<StatisticEntity>, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(StatisticDbService.name);
    }
    getStatisticCacheKey(collectionIds: number[]): string {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Dobs:Statistic:${collectionIds.join('_')}{tag}`;
        }
    async getStatisticFrom24HoursAgo(collectionIds: number[], filterFloorPrices?: boolean): Promise<StatisticEntity[]> {
            if (collectionIds.length == 0) {
                return [];
            }
            const key = this.getStatisticCacheKey(collectionIds);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let statistics = (await Promise.all(collectionIds.map((collectionId) => this.getStatisticForLastDay(collectionId, filterFloorPrices ?? false)))).filter((s): s is StatisticEntity => s !== null);
            await this.redis.set(key, JSON.stringify(statistics), 'EX', TIME.ONE_MINUTES);
            return statistics;
        }
    async getStatisticForLastDay(collectionId: number, filterFloorPrices: boolean): Promise<StatisticEntity | null> {
            const startTime = moment().subtract(1, 'day').unix();
            const endTime = moment().unix();
            let builder = this.statisticRepository
                .createQueryBuilder('statistic')
                .where('statistic.time BETWEEN :startTime AND :endTime AND statistic.collectionId = :collectionId', { startTime, endTime, collectionId });
            if (filterFloorPrices) {
                builder.andWhere('statistic.floorPrice > :zero', { zero: 0 });
            }
            const build = builder.orderBy('statistic.time');
            return await build.getOne();
        }
    async getLastTokenStatistic(where: FindOptionsWhere<StatisticEntity>): Promise<StatisticEntity | null> {
            return await this.statisticRepository.findOne({
                where,
                order: {
                    time: 'DESC',
                },
            });
        }
    async updateCollectionStatistic(entity: CollectionEntity, btcPrice: UsdPrice, dobsStatistic: DobsStatistic, statistic: ItemStatistic | undefined, floorItems: ItemFloorPrice | undefined, statisticFrom24HoursAgo: StatisticEntity | undefined): Promise<void> {
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let lastVolume = new Decimal(statistic ? (statistic.totalVolume ? statistic.totalVolume : 0) : 0).minus(new Decimal(statisticFrom24HoursAgo ? statisticFrom24HoursAgo.volume : 0));
                entity.lastHolders = new Decimal(dobsStatistic.holders);
                entity.updatedAt = new Date();
                entity.lastVolume = lastVolume;
                entity.totalSupply = new Decimal(dobsStatistic.totalSupply);
                entity.lastSales = new Decimal(statistic ? (statistic.salesCount ? statistic.salesCount : 0) : 0);
                entity.floorPrice = new Decimal(floorItems ? floorItems.price : 0);
                entity.marketCap = entity.totalSupply
                    .div(Decimal.pow(10, entity.decimals))
                    .mul(entity.floorPrice);
                await manager.save(entity);
                let now = moment();
                let nearestTenMinutes = Math.round(now.minutes() / 5) * 5;
                now.minutes(nearestTenMinutes);
                now.seconds(0);
                now.milliseconds(0);
                let statisticEntity = new StatisticEntity();
                statisticEntity.collectionId = entity.id;
                statisticEntity.time = now.unix();
                statisticEntity.sales = new Decimal(statistic ? (statistic.salesCount ? statistic.salesCount : 0) : 0);
                statisticEntity.holders = entity.lastHolders;
                statisticEntity.floorPrice = new Decimal(floorItems ? floorItems.price : 0);
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
                this.logger.error(`[updateCollectionStatistic] ${(error as Error)?.stack} `);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            this.logger.log(`[updateCollectionStatistic] ${entity.id}`);
        }
}
