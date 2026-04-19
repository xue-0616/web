// Recovered from dist/shared.module.js.map (source: ../../src/shared/shared.module.ts)

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { ApiConfigService, AppLoggerService, EmailService, RedisService, UpHttpService, ValidatorService } from './services';

let SendGridModule: any;
try { SendGridModule = require('@anchan828/nest-sendgrid').SendGridModule; } catch (_) {}

const providers = [
    ApiConfigService,
    AppLoggerService,
    EmailService,
    RedisService,
    UpHttpService,
    ValidatorService,
];

const imports: any[] = [
    ConfigModule,
    HttpModule,
    CqrsModule,
];

if (SendGridModule) {
    imports.push(
        SendGridModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ApiConfigService) => (configService as any).getSendGridConfig,
            inject: [ApiConfigService],
        }),
    );
}

@Global()
@Module({
    imports,
    providers,
    exports: [...providers, HttpModule, CqrsModule],
})
export class SharedModule {}
