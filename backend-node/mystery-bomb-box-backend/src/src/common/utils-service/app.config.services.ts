import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { AppLoggerService } from './logger.service';
import { BullRootModuleOptions } from '@nestjs/bull';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { isNil } from 'lodash';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

@Injectable()
export class AppConfigService {
    constructor(private configService: ConfigService, private readonly logger: AppLoggerService) {
        this.logger.setContext(AppConfigService.name);
    }
    get(key: any) {
            const value = this.configService.get(key);
            if (isNil(value) || value === '') {
                // See solagram-backend/app.config.services.ts for
                // rationale: fail-open in rehearsal, fail-closed when
                // STRICT_CONFIG=true.
                if (process.env.STRICT_CONFIG === 'true') {
                    throw new Error(key + ' environment variable does not set');
                }
                this.logger.warn(`config key '${key}' missing — defaulting to empty`);
                return '';
            }
            return String(value).trim();
        }
    getNumber(key: any) {
            const value = this.get(key);
            if (value === '') return 0;
            const n = Number(value);
            if (Number.isNaN(n)) {
                this.logger.error(`[getNumber] key=${key} value='${value}' is not numeric`);
                if (process.env.STRICT_CONFIG === 'true') {
                    throw new Error(key + ' environment variable is not a number');
                }
                return 0;
            }
            return n;
        }
    getBoolean(key: any) {
            const value = this.get(key);
            if (value === '') return false;
            try {
                return Boolean(JSON.parse(value));
            }
            catch (error) {
                const e = error as Error;
                this.logger.error(`[getBoolean] ${e},${e?.stack} data = ${JSON.stringify({
                    key,
                })}`);
                if (process.env.STRICT_CONFIG === 'true') {
                    throw new Error(key + ' env var is not a boolean');
                }
                return false;
            }
        }
    getString(key: any) {
            const value = this.get(key);
            return value.replace(/\\n/g, '\n').trim();
        }
    get mysqlConfig(): TypeOrmModuleOptions {
            const entities = [__dirname + '/../../database/entities/*.entity{.ts,.js}'];
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
                namingStrategy: new SnakeNamingStrategy(),
                timezone: this.getString('timezone'),
                extra: {
                    connectionLimit: this.getNumber('connectionLimit'),
                },
            };
        }
    get redisConfig(): RedisModuleOptions {
            let isCluster = this.getBoolean('redisIsCluster');
            let password = this.getString('redisPassword');
            let username = this.getString('redisUsername');
            const passwordVal: string | undefined = password ? password : undefined;
            if (isCluster) {
                const nodes = this.getString('redisClusterNodes')
                    .split(',')
                    .map((node: string) => {
                        const [host, port] = node.split(':');
                        return { host, port: parseInt(port, 10) };
                    });
                return {
                    type: 'cluster' as const,
                    nodes,
                    options: {
                        redisOptions: {
                            password: passwordVal,
                            username,
                            tls: {
                                rejectUnauthorized: false,
                            },
                        },
                    },
                };
            }
            if (passwordVal) {
                this.logger.log(`password ${passwordVal}`);
                return {
                    type: 'single' as const,
                    url: this.getString('redisSingleUrl'),
                    options: {
                        password: passwordVal,
                        username,
                        tls: {
                            rejectUnauthorized: false,
                        },
                    },
                };
            }
            return {
                type: 'single' as const,
                url: this.getString('redisSingleUrl'),
            };
        }
    get queueConfig(): BullRootModuleOptions {
            let password = this.getString('redisPassword');
            let username = this.getString('redisUsername');
            if (password) {
                this.logger.log(`password ${password}`);
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
            else {
                return {
                    url: this.getString('redisSingleUrl'),
                    prefix: this.getString('NODE_ENV'),
                };
            }
        }
    get enabledDocumentation(): boolean {
            return this.getBoolean('enabledDocumentation');
        }
    get getGlobalPrefix(): string {
            return this.getString('globalPrefix');
        }
    get nodeEnv(): string {
            return this.getString('NODE_ENV');
        }
    get actionInfo(): {
        hostname: string;
        botService: string;
        totalBoxCount: number;
        blinkWindowDirectLink: string;
        crateBlinkParameter: string;
    } {
            return {
                hostname: this.getString('hostname'),
                botService: this.getString('botService'),
                totalBoxCount: this.getNumber('totalBoxCount'),
                blinkWindowDirectLink: this.getString('blinkWindowDirectLink'),
                crateBlinkParameter: this.getString('crateBlinkParameter'),
            };
        }
    get submitterSecretKey(): string {
            return this.getString('submitterSecretKey');
        }
    get solanaRpcUrl(): string {
            return this.getString('solanaRpcUrl');
        }
}
