import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const REDIS_CLIENT_TOKEN = 'REDIS_CLIENT';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_CLIENT_TOKEN,
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                const redisConfig = configService.get('redis');
                // Respect REDIS_TLS=false for local dev (plain Redis container).
                const tlsEnabled = process.env.REDIS_TLS !== 'false';
                return new Redis({
                    host: redisConfig.host,
                    port: redisConfig.port,
                    password: redisConfig.password || undefined,
                    username: redisConfig.username || undefined,
                    db: redisConfig.db,
                    maxRetriesPerRequest: null,
                    ...(tlsEnabled && {
                        tls: { rejectUnauthorized: false },
                    }),
                });
            },
        },
        // Alias so services that inject by class (`redisClient: Redis`) resolve
        // to the same singleton as services that use @Inject('REDIS_CLIENT').
        {
            provide: Redis,
            useExisting: REDIS_CLIENT_TOKEN,
        },
    ],
    exports: [REDIS_CLIENT_TOKEN, Redis],
})
export class RedisModule {}
