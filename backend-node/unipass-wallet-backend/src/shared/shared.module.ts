import { CacheModule, Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService, ValidatorService, AppLoggerService, RedisService, UnipassConfigService, EmailService, ProviderService, UpHttpService } from './services';
import { SendGridModule } from '@anchan828/nest-sendgrid';

const providers = [
    ApiConfigService,
    ValidatorService,
    AppLoggerService,
    RedisService,
    UnipassConfigService,
    EmailService,
    ProviderService,
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
            SendGridModule.forRootAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.getSendGridConfig,
                inject: [ApiConfigService],
            }),
        ],
        exports: [...providers, HttpModule, CqrsModule],
    })
export class SharedModule {
}
