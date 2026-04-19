// Recovered from dist/service.indicator.js.map (source: ../../../../src/modules/health-checker/health-indicators/service.indicator.ts)

import { Injectable, Optional, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { AppLoggerService } from '../../../shared/services';

@Injectable()
export class ServiceHealthIndicator extends HealthIndicator {
    constructor(
        @Optional() @Inject('NATS_SERVICE') private readonly client: any,
        private readonly logger: AppLoggerService,
    ) {
        super();
        this.logger.setContext(ServiceHealthIndicator.name);
    }

    async isHealthy(eventName: string): Promise<HealthIndicatorResult> {
        try {
            const result = this.getStatus(eventName, true);
            return result;
        } catch (error: any) {
            this.logger.error(`[isHealthy]  ${error},${error?.stack}`);
            throw new HealthCheckError(`${eventName} failed`, {
                [eventName]: error,
            });
        }
    }
}
