import { CacheModule, Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService, ValidatorService, AppLoggerService, RedisService, UpHttpService } from './services';

const providers = [
    ApiConfigService,
    ValidatorService,
    AppLoggerService,
    RedisService,
    UpHttpService,
];

@Global()
@Module({
        providers,
        imports: [
            HttpModule,
            CqrsModule,
            CacheModule.registerAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.redisConfig,
                inject: [ApiConfigService],
            }),
        ],
        exports: [...providers, HttpModule, CqrsModule],
    })
export class SharedModule {
}
