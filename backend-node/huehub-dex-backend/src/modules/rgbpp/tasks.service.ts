import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { TokenStatisticService } from './tokens/token.statistic.service';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { MarketTokensService } from './tokens/market.tokens.service';
import { ItemService } from './order/item.service';
import { BtcService } from '../btc/btc.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { RedlockService } from '../../common/utils-service/redlock.service';
import { TIME } from '../../common/utils/const.config';

@Injectable()
export class TasksService {
    constructor(private readonly appConfig: AppConfigService, private readonly logger: AppLoggerService, private readonly tokenDbService: MarketTokensService, private readonly itemService: ItemService, private readonly btcService: BtcService, private readonly tokenStatisticService: TokenStatisticService, private readonly redlockService: RedlockService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(TasksService.name);
        this.initTokenStatistic([]);
    }
    tokenStatisticsCacheKey() {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Task:TokenStatistics:{tag}`;
        }
    @Cron('0 */5 * * * *')
    async startTokenStatistics(): Promise<void> {
            const key = this.tokenStatisticsCacheKey();
            const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
            if (lock) {
                this.logger.log('[startTokenStatistics] task start');
                try {
                    let tokenList = await this.tokenDbService.getAllStaticTokens();
                    let tokenIds = tokenList.map((x) => x.id);
                    const [statistics, floorItems, btcPrice, statisticFrom24HoursAgo] = await Promise.all([
                        this.itemService.getAllTotalSaleCountAndVolume(tokenIds),
                        await this.itemService.getAllMinimalFloorPriceItem(tokenIds),
                        this.btcService.getBtcPrice(),
                        this.tokenStatisticService.getStatisticFrom24HoursAgo(tokenIds),
                    ]);
                    await Promise.all(tokenList.map((x) => this.tokenStatisticService.updateTokenInfoAndStatisticsToken(x, statistics, floorItems, btcPrice, statisticFrom24HoursAgo)));
                }
                catch (error) {
                    this.logger.error(`[startTokenStatistics] job: ${(error as Error)?.stack}}`);
                }
                finally {
                    await this.redlockService.releaseLock(lock);
                }
            }
            else {
                this.logger.log('[startTokenStatistics] task is already running on another instance');
            }
        }
    async initTokenStatistic(tokenId: number[]): Promise<void> {
            try {
                let tokenList = await this.tokenDbService.findInitializeStatisticsTokens(tokenId);
                let tokenIds = tokenList.map((x) => x.id);
                const [statistics, statisticFrom24HoursAgo, floorItems] = await Promise.all([
                    this.itemService.getAllTotalSaleCountAndVolume(tokenIds),
                    this.tokenStatisticService.getStatisticFrom24HoursAgo(tokenIds),
                    await this.itemService.getAllMinimalFloorPriceItem(tokenIds),
                ]);
                await Promise.all(tokenList.map((x) => this.tokenStatisticService.initStatisticsToken(x, statistics, statisticFrom24HoursAgo, floorItems)));
            }
            catch (error) {
                this.logger.error(`[initTokenStatistic] job: ${(error as Error)?.stack}}`);
            }
        }
}
