import { MyHttpService } from '../../common/utils-service/http.service';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import Redis from 'ioredis';
import { RedlockService } from '../../common/utils-service/redlock.service';
import { BlinkListOutput } from './dto/blink.list.output.dto';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { TIME } from '../../common/utils/time';

@Injectable()
export class BlinkService {
    constructor(
        private readonly myHttpService: MyHttpService,
        private readonly logger: AppLoggerService,
        private readonly appConfig: AppConfigService,
        private readonly redlockService: RedlockService,
        @InjectRedis() private readonly redis: Redis,
    ) {
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
        return `${this.appConfig.nodeEnv}:OPEN:TG:ALL:ACTION:{tag}`;
    }
    async getAllActions(): Promise<string[] | undefined> {
        let url = `https://actions-registry.dialectapi.to/all`;
        let data = await this.myHttpService.httpGet(url);
        if (data) {
            const hosts = (data.actions as Array<{ state: string; host: string }>).reduce<string[]>(
                (acc, action) => {
                    if (action.state === 'trusted') {
                        acc.push(action.host);
                    }
                    return acc;
                },
                [],
            );
            let key = this.getAllActionsKey();
            await this.redis.set(key, JSON.stringify(hosts), 'EX', TIME.HALF_HOUR * 24);
            return hosts;
        }
        return undefined;
    }
    updateTaskKey() {
        return `${this.appConfig.nodeEnv}:OPEN:TG:TASK:ACTION:{tag}`;
    }
    async updateActions(): Promise<void> {
        let key = this.updateTaskKey();
        const lock = await this.redlockService.acquireLock([key], TIME.ONE_MINUTES * 1000);
        if (!lock) {
            return;
        }
        await this.getAllActions();
        await this.redlockService.releaseLock(lock);
    }
}
