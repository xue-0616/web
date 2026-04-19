import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { AppLoggerService } from './logger.service';
import { BullRootModuleOptions } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { isNil } from 'lodash';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { MyCustomLogger } from './my.custom.logger';

@Injectable()
export class AppConfigService {
    constructor(
        private readonly configService: ConfigService,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(AppConfigService.name);
    }
    get(key: string): string {
        const value = this.configService.get(key);
        if (isNil(value)) {
            throw new Error(key + ' environment variable does not set');
        }
        return value.trim();
    }
    getNumber(key: string): number {
        const value = this.get(key);
        try {
            return Number(value);
        }
        catch (error) {
            const e = error as Error;
            this.logger.error(`[getNumber] ${e},${e?.stack} data = ${JSON.stringify({
                key,
            })}`);
            throw new Error(key + ' environment variable is not a number');
        }
    }
    getBoolean(key: string): boolean {
        const value = this.get(key);
        try {
            return Boolean(JSON.parse(value));
        }
        catch (error) {
            const e = error as Error;
            this.logger.error(`[getBoolean] ${e},${e?.stack} data = ${JSON.stringify({
                key,
            })}`);
            throw new Error(key + ' env var is not a boolean');
        }
    }
    getString(key: string): string {
        const value = this.get(key);
        return value.replace(/\\n/g, '\n').trim();
    }
    get mysqlConfig() {
        const entities = [__dirname + '/../../database/**/*.entity{.ts,.js}'];
        const migrations = [__dirname + '/../../database/migrations/*{.ts,.js}'];
        return {
            entities,
            migrations,
            keepConnectionAlive: true,
            type: 'mysql',
            host: this.getString('dbHost'),
            port: this.getNumber('dbPort'),
            username: this.getString('dbUsername'),
            password: this.getString('dbPassword'),
            database: this.getString('dbDatabase'),
            migrationsRun: true,
            logging: this.getBoolean('enableOrmLogs'),
            maxQueryExecutionTime: this.getNumber('maxQueryExecutionTime'),
            logger: new MyCustomLogger(this.logger),
            namingStrategy: new SnakeNamingStrategy(),
            timezone: this.getString('timezone'),
            extra: {
                connectionLimit: this.getNumber('connectionLimit'),
            },
        };
    }
    get redisConfig(): RedisModuleOptions {
        const isCluster = this.getBoolean('redisIsCluster');
        const rawPassword = this.getString('redisPassword');
        const password = rawPassword ? rawPassword : undefined;
        const username = this.getString('redisUsername');
        if (isCluster) {
            const nodes = this.getString('redisClusterNodes')
                .split(',')
                .map((node) => {
                    const [host, port] = node.split(':');
                    return { host, port: parseInt(port, 10) };
                });
            return {
                type: 'cluster' as const,
                nodes,
                options: {
                    redisOptions: {
                        password,
                        username,
                        tls: {
                            rejectUnauthorized: false,
                        },
                    },
                },
            };
        }
        return {
            type: 'single' as const,
            url: this.getString('redisSingleUrl'),
            options: {
                password,
                username,
                tls: {
                    rejectUnauthorized: false,
                },
                connectTimeout: 10000,
            },
        };
    }
    get queueConfig() {
        const password = this.getString('redisPassword');
        const username = this.getString('redisUsername');
        return {
            url: this.getString('redisSingleUrl'),
            redis: {
                username,
                password,
                tls: {
                    rejectUnauthorized: false,
                },
            },
            prefix: this.getString('NODE_ENV'),
        };
    }
    get enabledDocumentation() {
        return this.getBoolean('enabledDocumentation');
    }
    get jwtConfig() {
        return {
            secret: this.getString('jwtSecretKey'),
            signOptions: { expiresIn: this.getString('jwtExpiresIn') },
        };
    }
    get nodeEnv() {
        return this.getString('NODE_ENV');
    }
    get isTestnet() {
        return this.getBoolean('isTestnet');
    }
    get cellManagerConfig() {
        return {
            ckbNodeUrl: this.getString('ckbNodeUrl'),
            ckbIndexerUrl: this.getString('ckbIndexerUrl'),
            cellManagerKey: this.getString('cellManagerPrivateKey'),
            candidateCellCapacity: this.getNumber('candidateCellCapacity'),
            candidateCellMaxNumber: this.getNumber('candidateCellsMaxNumber'),
            utxoSwapServerUrl: this.getString('utxoSwapServerUrl'),
        };
    }
}
