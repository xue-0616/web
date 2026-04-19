import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as redisStore from 'cache-manager-redis-store';

export default registerAs('redis', () => {;
    const secretPath = process.env.SECRET_PATH;
    const env = process.env.NODE_ENV || 'DEV';
    if (!secretPath) {
        throw new Error('expected secret path');
    }
    const secretConfig = JSON.parse(readFileSync(secretPath).toString());
    const redisConfig = secretConfig.redis;
    // Allow configuring TLS certificate validation via environment variable.
    // Defaults to true (secure). Set REDIS_TLS_REJECT_UNAUTHORIZED=false only for dev/testing.
    const rejectUnauthorized = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false';
    // REDIS_TLS=false disables TLS entirely (for local docker-run Redis without certs).
    const tlsEnabled = process.env.REDIS_TLS !== 'false';
    return {
        store: redisStore,
        host: redisConfig.host,
        port: redisConfig.port,
        username: redisConfig.username,
        password: redisConfig.password,
        db: redisConfig.redisDb || 0,
        prefix: `${env}:DEXAUTO:`,
        ...(tlsEnabled && {
            socket: {
                tls: true,
                rejectUnauthorized,
            },
            tls: {
                rejectUnauthorized,
            },
        }),
    };
});
