import { Controller, Get } from '@nestjs/common';
import { HealthCheck } from '@nestjs/terminus';

@Controller('health')
export class HealthCheckerController {
    constructor(healthCheckService: any, ormIndicator: any, serviceIndicator: any, logger: any) {
        this.healthCheckService = healthCheckService;
        this.ormIndicator = ormIndicator;
        this.serviceIndicator = serviceIndicator;
        this.logger = logger;
        this.logger.setContext(HealthCheckerController.name);
    }
    healthCheckService: any;
    ormIndicator: any;
    serviceIndicator: any;
    logger: any;
    @Get()
    @HealthCheck()
    async check() {
            return this.healthCheckService.check([
                () => this.serviceIndicator.isHealthy('search-service-health'),
            ]);
        }
}
