import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './services/redis.service';
import { UtilService } from './services/util.service';
import { ApiConfigService } from './services/api-config.service';
import { ProviderService } from './services/providers.server';
import { UpHttpService } from './services/up.http.service';

const providers = [UtilService, RedisService, ApiConfigService, ProviderService, UpHttpService];

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    RedisModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('redis.host'),
        port: configService.get<number>('redis.port'),
        password: configService.get<string>('redis.password'),
        db: configService.get<number>('redis.db'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers,
  exports: providers,
})
export class SharedModule {}
