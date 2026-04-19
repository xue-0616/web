import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClickHouseService } from './clickhouse.service';

@Global()
@Module({
        imports: [ConfigModule],
        providers: [ClickHouseService],
        exports: [ClickHouseService],
    })
export class ClickHouseModule {
}
