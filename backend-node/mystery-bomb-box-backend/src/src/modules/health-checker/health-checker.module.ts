import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CommonModule } from '../../common/common.module';
import { HealthCheckerController } from './health-checker.controller';
import { RedisHealthIndicator } from './redis-health.indicator';

@Module({
        imports: [TerminusModule, CommonModule],
        controllers: [HealthCheckerController],
        providers: [RedisHealthIndicator],
    })
export class HealthCheckerModule {
}
