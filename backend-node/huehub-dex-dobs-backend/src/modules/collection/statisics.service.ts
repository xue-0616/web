import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { CollectionDbService, StatisticDbService } from './db.service';
import { ItemsDbService } from '../market/db.service.ts/item.db.service';
import { BtcService } from '../btc/btc.service';
import { CollectionEntity, DobsStatus, StatisticEntity } from '../../database/entities';
import { ItemFloorPrice, ItemStatistic } from '../../common/interface/statistic';
import { UsdPrice } from '../../common/interface/mempool.dto';
import { IndexerDbService } from '../indexer/indexer.db.service';

@Injectable()
export class StatisticService {
    constructor(private readonly logger: AppLoggerService, private readonly collectionDbService: CollectionDbService, private readonly itemsDbService: ItemsDbService, private readonly btcService: BtcService, private readonly statisticDbService: StatisticDbService, private readonly indexerDbService: IndexerDbService) {
        this.logger.setContext(StatisticService.name);
    }
    async collectionStatistics(): Promise<void> {
            let collections = await this.collectionDbService.find({
                status: DobsStatus.Listing,
            });
            let collectionIds = collections.map((collection) => collection.id);
            const [statistics, floorItems, btcPrice, statisticFrom24HoursAgo] = await Promise.all([
                this.itemsDbService.getAllTotalSaleCountAndVolume(collectionIds),
                await this.itemsDbService.getAllMinimalFloorPriceItem(collectionIds),
                this.btcService.getBtcPrice(),
                this.statisticDbService.getStatisticFrom24HoursAgo(collectionIds),
            ]);
            await Promise.all(collections.map((x) => this.updateStatisitc(x, statistics, floorItems, btcPrice, statisticFrom24HoursAgo)));
        }
    async updateStatisitc(entity: CollectionEntity, statistics: ItemStatistic[], floorItems: ItemFloorPrice[], usdPrice: UsdPrice, statisticFrom24HoursAgoList: StatisticEntity[]): Promise<void> {
            let statistic = statistics.find((statistic) => statistic.collectionId === entity.id.toString());
            let statisticFrom24HoursAgo = statisticFrom24HoursAgoList.find((statistic) => statistic.collectionId === entity.id);
            let floorItem = floorItems.find((item) => item.collectionId === entity.id.toString());
            try {
                let dobsStatistic = await this.indexerDbService.queryHoldersAndTotalSupply(entity.clusterTypeArgs);
                await this.statisticDbService.updateCollectionStatistic(entity, usdPrice, dobsStatistic, statistic, floorItem, statisticFrom24HoursAgo);
            }
            catch (error) {
                this.logger.error(`[updateStatisitc] ${(error as Error)?.stack} `);
            }
        }
}
