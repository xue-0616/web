import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CommonModule } from '../../common/common.module';
import { HealthCheckerController } from './health.checker.controller';
import { GitCommitHealthIndicator } from './git.commit.health.indicator';

@Module({
        imports: [TerminusModule, CommonModule],
        controllers: [HealthCheckerController],
        providers: [GitCommitHealthIndicator],
    })
export class HealthCheckerModule {
}
