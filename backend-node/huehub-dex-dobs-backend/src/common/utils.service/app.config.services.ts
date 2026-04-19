import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { JwtModuleOptions } from '@nestjs/jwt';
import { AppLoggerService } from './logger.service';
import { BullRootModuleOptions } from '@nestjs/bull';
import { isNil } from 'lodash';
import { MyCustomLogger } from './my.custom.logger';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

@Injectable()
export class AppConfigService {
    constructor(private configService: ConfigService, private readonly logger: AppLoggerService) {
        this.logger.setContext(AppConfigService.name);
    }
    get(key: any) {
            const value = this.configService.get(key);
            if (isNil(value)) {
                throw new Error(key + ' environment variable does not set');
            }
            return value.trim();
        }
    getNumber(key: any) {
            const value = this.get(key);
            try {
                return Number(value);
            }
            catch (error) {
                this.logger.error(`[getNumber] ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    key,
                })}`);
                throw new Error(key + ' environment variable is not a number');
            }
        }
    getBoolean(key: any) {
            const value = this.get(key);
            try {
                return Boolean(JSON.parse(value));
            }
            catch (error) {
                this.logger.error(`[getBoolean] ${error},${(error as Error)?.stack} data = ${JSON.stringify({
                    key,
                })}`);
                throw new Error(key + ' env var is not a boolean');
            }
        }
    getString(key: any) {
            const value = this.get(key);
            return value.replace(/\\n/g, '\n').trim();
        }
    get mysqlConfig(): TypeOrmModuleOptions {
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
            let isCluster = this.getBoolean('redisIsCluster');
            let password = this.getString('redisPassword');
            let username = this.getString('redisUsername');
            const passwordVal: string | undefined = password ? password : undefined;
            if (isCluster) {
                const nodes = this.getString('redisClusterNodes')
                    .split(',')
                    .map((node: any) => {
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
    get queueConfig(): BullRootModuleOptions {
            let password = this.getString('redisPassword');
            let username = this.getString('redisUsername');
            return {
                url: this.getString('redisSingleUrl'),
                redis: {
                    username,
                    password,
                    tls: {
                        rejectUnauthorized: false,
                    },
                },
                prefix: this.getString('nodeEnv'),
            };
        }
    get enabledDocumentation(): boolean {
            return this.getBoolean('enabledDocumentation');
        }
    get jwtConfig(): JwtModuleOptions {
            return {
                secret: this.getString('jwtSecretKey'),
                signOptions: { expiresIn: this.getString('jwtExpiresIn') },
            };
        }
    get nodeEnv(): string {
            return this.getString('nodeEnv');
        }
    get isTestnet(): boolean {
            return this.getBoolean('isTestnet');
        }
    get rgbPPConfig(): {
        receiveFeeAddress: string;
        feeRate: string;
        btcAssetsApiUrl: string;
        btcApiOrigin: string;
        btcApiToken: string;
        ckbNodeUrl: string;
        ckbIndexerUrl: string;
        electrsUrl: string;
        mempoolUrl: string;
        dobsApiUrl: string;
        minMarketFee: number;
        dobsMediaHost: string;
    } {
            return {
                receiveFeeAddress: this.getString('receiveFeeAddress'),
                feeRate: this.getString('feeRate'),
                btcAssetsApiUrl: this.getString('btcAssetsApiUrl'),
                btcApiOrigin: this.getString('btcApiOrigin'),
                btcApiToken: this.getString('btcApiToken'),
                ckbNodeUrl: this.getString('ckbNodeUrl'),
                ckbIndexerUrl: this.getString('ckbIndexerUrl'),
                electrsUrl: this.getString('electrsUrl'),
                mempoolUrl: this.getString('mempoolUrl'),
                dobsApiUrl: this.getString('dobsApiUrl'),
                minMarketFee: this.getNumber('minMarketFee'),
                dobsMediaHost: this.getString('dobsMediaHost'),
            };
        }
    get cmcApiKey(): string {
            return this.getString('cmcApiKey');
        }
}
