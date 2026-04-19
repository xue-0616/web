import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(
        private readonly logger: AppLoggerService,
        @InjectRedis() private readonly redis: Redis,
    ) {
        super();
        this.logger.setContext(RedisHealthIndicator.name);
    }
    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            const result = await this.redis.ping();
            if (result === 'PONG') {
                return this.getStatus(key, true);
            }
            else {
                return this.getStatus(key, false);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new HealthCheckError('Redis check failed', this.getStatus(key, false, { error: message }));
        }
    }
}
