import { Controller, Get } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { GitCommitHealthIndicator } from './git.commit.health.indicator';
import { OpenAccess } from '../../decorators/open.access.decorator';

@Controller('health')
@OpenAccess()
export class HealthCheckerController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly gitCommitIndicator: GitCommitHealthIndicator,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(HealthCheckerController.name);
  }

  @Get()
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }
}
