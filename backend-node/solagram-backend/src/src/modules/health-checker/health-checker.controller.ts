import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { RedisHealthIndicator } from './redis-health.indicator';

@Controller('health')
export class HealthCheckerController {
    constructor(private health: HealthCheckService, private redisIndicator: RedisHealthIndicator, private readonly logger: AppLoggerService) {
        this.logger.setContext(HealthCheckerController.name);
    }
    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
            return this.health.check([() => this.redisIndicator.isHealthy('redis')]);
        }
}
