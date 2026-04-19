// Recovered from dist/health-checker.controller.js.map (source: ../../../src/modules/health-checker/health-checker.controller.ts)

import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ServiceHealthIndicator } from './health-indicators/service.indicator';
import { AppLoggerService } from '../../shared/services';

@Controller('health')
export class HealthCheckerController {
    constructor(
        private readonly healthCheckService: HealthCheckService,
        private readonly ormIndicator: TypeOrmHealthIndicator,
        private readonly serviceIndicator: ServiceHealthIndicator,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(HealthCheckerController.name);
    }

    @Get()
    @HealthCheck()
    async check(): Promise<any> {
        return this.healthCheckService.check([
            () => this.ormIndicator.pingCheck('database'),
            () => this.serviceIndicator.isHealthy('search-service-health'),
        ]);
    }
}
