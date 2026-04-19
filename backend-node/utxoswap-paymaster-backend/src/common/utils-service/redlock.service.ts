import { Redis } from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { AppLoggerService } from './logger.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RedlockService {
    private readonly redlock: Redlock;

    constructor(
        @InjectRedis() private readonly redis: Redis,
        private readonly logger: AppLoggerService,
    ) {
        this.redlock = new Redlock([this.redis as any], {
            driftFactor: 0.01,
            retryDelay: 200,
            retryCount: 10,
            retryJitter: 200,
        });
        this.logger.setContext(RedlockService.name);
    }

    async acquireLock(resource: string | string[], ttl: number): Promise<Lock | null> {
        try {
            const res = Array.isArray(resource) ? resource : [resource];
            const lock = await this.redlock.acquire(res, ttl);
            return lock;
        } catch (err) {
            this.logger.error(`[acquireLock] Error acquiring lock: ${err}`);
            return null;
        }
    }

    async releaseLock(lock: Lock): Promise<void> {
        try {
            await this.redlock.release(lock);
        } catch (err) {
            this.logger.error(`[releaseLock] Error releasing lock: ${err}`);
        }
    }
}
