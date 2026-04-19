import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus';
import { OpenAccess } from '../../decorators/open.access.decorator';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { GitCommitHealthIndicator } from './git.commit.health.indicator';

@Controller('health')
export class HealthCheckerController {
    constructor(private health: HealthCheckService, private gitCommitIndicator: GitCommitHealthIndicator, private readonly logger: AppLoggerService) {
        this.logger.setContext(HealthCheckerController.name);
    }
    @Get()
    @HealthCheck()
    @OpenAccess()
    check(): Promise<HealthCheckResult> {
            return this.health.check([]);
        }
}
