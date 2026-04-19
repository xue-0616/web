import { ClickHouseClientConfigOptions } from '@clickhouse/client';
import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';

export default registerAs('clickhouse', () => {;
    const secretPath = process.env.SECRET_PATH;
    if (!secretPath) {
        throw new Error('expected secret path');
    }
    const secretConfig = JSON.parse(readFileSync(secretPath).toString());
    const clickhouseConfig = secretConfig.clickhouse;
    if (!clickhouseConfig) {
        throw new Error('ClickHouse configuration not found in secrets file');
    }
    return {
        host: clickhouseConfig.host,
        username: clickhouseConfig.username,
        password: clickhouseConfig.password,
        database: clickhouseConfig.database,
        max_open_connections: clickhouseConfig.maxOpenConnections || 10,
        request_timeout: clickhouseConfig.requestTimeout || 30000,
        compression: {
            response: true,
            request: true,
        },
    };
});
