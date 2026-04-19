import { CacheModule, Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService } from './services';
import * as servicesIndex from './services';

const providers: any[] = Object.values(servicesIndex as any).filter((v: any) => typeof v === 'function');

@Global()
@Module({
        providers,
        imports: [
            HttpModule,
            CqrsModule,
            JwtModule.registerAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.jwtConfig,
                inject: [ApiConfigService],
            }),
            CacheModule.registerAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.redisConfig,
                inject: [ApiConfigService],
            }),
        ],
        exports: [...providers, HttpModule],
    })
export class SharedModule {
}
