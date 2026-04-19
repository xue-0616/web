import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';

@Injectable()
export class RedisService {
    constructor(@Inject(CACHE_MANAGER) redis: any) {
        this.redis = redis;
    }
    redis: any;
    async saveCacheData(key: any, value: any, ttl: any) {
            await this.redis.set(key, value, { ttl });
        }
    async deleteCacheData(key: any) {
            if (this.redis.del) {
                await this.redis.del(key);
            }
        }
    async getCacheData(key: any) {
            if (!key) {
                return undefined;
            }
            return (await this.redis.get(key));
        }
}
