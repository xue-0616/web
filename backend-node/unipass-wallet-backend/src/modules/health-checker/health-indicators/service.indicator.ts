import { Inject, Injectable, Optional } from '@nestjs/common';
import { HealthCheckError, HealthIndicator } from '@nestjs/terminus';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable()
export class ServiceHealthIndicator extends HealthIndicator {
    constructor(@Optional() @Inject('NATS_SERVICE') clientProxy: any, logger: any) {
        super();
        this.clientProxy = clientProxy;
        this.logger = logger;
    }
    clientProxy: any;
    logger: any;
    async isHealthy(eventName: any) {
            try {
                if (!this.clientProxy) {
                    return {
                        [eventName]: {
                            status: 'down',
                        },
                    };
                }
                const result = await firstValueFrom(this.clientProxy.send(eventName, { check: true }).pipe(timeout(10000)), {
                    defaultValue: undefined,
                });
                return {
                    [eventName]: result,
                };
            }
            catch (error) {
                this.logger.error(`[isHealthy]  ${error},${(error as Error)?.stack}`);
                throw new HealthCheckError(`${eventName} failed`, {
                    [eventName]: error,
                });
            }
        }
}
