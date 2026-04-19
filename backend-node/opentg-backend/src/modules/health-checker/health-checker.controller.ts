import { AppLoggerService } from '../../common/utils-service/logger.service';
import { HealthCheck, HealthCheckService, HealthCheckResult, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthCheckerController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly ormIndicator: TypeOrmHealthIndicator,
        private readonly redisIndicator: RedisHealthIndicator,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(HealthCheckerController.name);
    }

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.ormIndicator.pingCheck('database', { timeout: 5000 }),
            () => this.redisIndicator.isHealthy('redis'),
        ]);
    }
}
