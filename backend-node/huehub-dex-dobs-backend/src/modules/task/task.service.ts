import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import { RedlockService } from '../../common/utils.service/redlock.service';
import { StatisticService } from '../collection/statisics.service';
import { TIME } from '../../common/utils/const.config';

@Injectable()
export class TaskService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfigService: AppConfigService, private readonly redlockService: RedlockService, private readonly statisticService: StatisticService) {
        this.logger.setContext(TaskService.name);
    }
    statisticsCacheKey() {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Task:Dobs:Statistics:{tag}`;
        }
    @Cron('0 */5 * * * *')
    async collectionStatistics(): Promise<void> {
            const key = this.statisticsCacheKey();
            const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
            if (lock) {
                try {
                    await this.statisticService.collectionStatistics();
                }
                catch (error) {
                    this.logger.error(`[collectionStatistics] task error: ${(error as Error)?.stack}}`);
                }
                finally {
                    await this.redlockService.releaseLock(lock);
                }
            }
            else {
                this.logger.log('[collectionStatistics] task is already running on another instance');
            }
        }
}
