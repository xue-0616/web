import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { MyHttpService } from '../../common/utils-service/http.service';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import Redis from 'ioredis';
import { RedlockService } from '../../common/utils-service/redlock.service';
import { BlinkListOutput } from './dto/blink.list.output.dto';
import { BlinkShortCodeDBService } from './blink-short-code-db.service';
import { BlinkShortCodeOutputDto } from './dto/blink.short.code.output.dto';
import { TIME } from '../../common/utils/time';

@Injectable()
export class BlinkService {
    constructor(private readonly myHttpService: MyHttpService, private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly redlockService: RedlockService, private readonly blinkShortCodeDBService: BlinkShortCodeDBService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(BlinkService.name);
    }
    async getAllTrustedHost(): Promise<BlinkListOutput> {
            let key = this.getAllActionsKey();
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return {
                    list: JSON.parse(cacheData),
                };
            }
            let list = await this.getAllActions();
            return { list: list ? list : [] };
        }
    getAllActionsKey() {
            return `${this.appConfig.nodeEnv}:Solagram:TG:ALL:ACTION:{tag}`;
        }
    async getAllActions(): Promise<string[]> {
            let url = `https://actions-registry.dialectapi.to/all`;
            let data = await this.myHttpService.httpGet(url);
            if (data) {
                const actionsHosts = this.extractTrustedHosts(data.actions);
                const websitesHosts = this.extractTrustedHosts(data.websites);
                const interstitialsHosts = this.extractTrustedHosts(data.interstitials);
                let hosts = [...actionsHosts, ...websitesHosts, ...interstitialsHosts];
                let key = this.getAllActionsKey();
                await this.redis.set(key, JSON.stringify(hosts), 'EX', TIME.HALF_HOUR * 24);
                return hosts;
            }
            return [];
        }
    extractTrustedHosts(data: {
        state: string;
        host: string;
    }[]): string[] {
            return data.reduce<string[]>((acc, action) => {
                if (action.state === 'trusted') {
                    acc.push(action.host);
                }
                return acc;
            }, []);
        }
    updateTaskKey() {
            return `${this.appConfig.nodeEnv}:Solagram:TG:TASK:ACTION:{tag}`;
        }
    @Cron('0 */1 * * * *')
    async updateActions(): Promise<void> {
            let key = this.updateTaskKey();
            const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
            if (!lock) {
                return;
            }
            await this.getAllActions();
            await this.redlockService.releaseLock(lock);
        }
    shortCodeCacheKey(shortCode: any) {
            return `${this.appConfig.nodeEnv}:Solagram:Blink:${shortCode}:{tag}`;
        }
    async getUrlByShortCode(shortCode: string): Promise<BlinkShortCodeOutputDto> {
            const cacheKey = this.shortCodeCacheKey(shortCode);
            const cachedData = await this.redis.get(cacheKey);
            if (cachedData) {
                return { url: cachedData };
            }
            const databaseRecord = await this.blinkShortCodeDBService.findOne({
                shortCode,
            });
            if (databaseRecord) {
                await this.redis.set(cacheKey, databaseRecord.blink, 'EX', TIME.HALF_HOUR);
                return { url: databaseRecord.blink };
            }
            return { url: null };
        }
}
