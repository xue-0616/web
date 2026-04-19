// Recovered from dist/redis.service.js.map (source: ../../../src/shared/services/redis.service.ts)
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private readonly redis: any) {}

  async saveCacheData(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!key) {
      return;
    }
    await this.redis.set(key, value, { ttl });
  }

  async deleteCacheData(key: string): Promise<void> {
    if (this.redis?.del) {
      await this.redis.del(key);
    }
  }

  async getCacheData(key: string): Promise<any> {
    if (!key) {
      return undefined;
    }
    return await this.redis.get(key);
  }
}
