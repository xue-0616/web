import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import { execSync } from 'child_process';

@Injectable()
export class GitCommitHealthIndicator extends HealthIndicator {
    async isHealthy(key: string): Promise<HealthIndicatorResult> {
        try {
            const commit = execSync('git rev-parse HEAD').toString().trim();
            return this.getStatus(key, true, { commit });
        }
        catch (error) {
            throw new HealthCheckError('GitCommitIndicator failed', this.getStatus(key, false));
        }
    }
}
