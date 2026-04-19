import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import Redlock, { Lock } from 'redlock';
import { AppLoggerService } from './logger.service';

@Injectable()
export class RedlockService {
    constructor(@InjectRedis() private readonly redis: Redis, private readonly logger: AppLoggerService) {
        this.redlock = new Redlock([this.redis], {
            driftFactor: 0.01,
            retryDelay: 200,
            retryCount: 10,
            retryJitter: 100,
        });
        this.logger.setContext(RedlockService.name);
    }
    private redlock: any;
    async acquireLock(resource: string[], ttl: number): Promise<Lock | null> {
            try {
                const lock = await this.redlock.acquire(resource, ttl);
                return lock;
            }
            catch (err) {
                this.logger.error(`[acquireLock] Error acquiring lock: ${err}`);
                return null;
            }
        }
    async releaseLock(lock: Lock): Promise<void> {
            try {
                await this.redlock.release(lock);
            }
            catch (err) {
                this.logger.error(`[releaseLock] Error releasing lock: ${err}`);
            }
        }
}
