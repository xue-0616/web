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
        indexerUrl: string;
        receiveFeeAddress: string;
        feeRate: string;
        btcAssetsApiUrl: string;
        btcApiOrigin: string;
        btcApiToken: string;
        ckbNodeUrl: string;
        ckbIndexerUrl: string;
        electrsUrl: string;
        mempoolUrl: string;
        minMarketFee: number;
        paymasterAddress: string;
        distributorTimeLockCkbAddress: string;
        ckbCellCost: number;
        mintFee: number;
        deployFee: number;
        symbolBlacklist: string;
        launchpadMintFee: number;
        launchpadPaymasterAddress: string;
    } {
            return {
                indexerUrl: this.getString('rgbppIndexer'),
                receiveFeeAddress: this.getString('receiveFeeAddress'),
                feeRate: this.getString('feeRate'),
                btcAssetsApiUrl: this.getString('btcAssetsApiUrl'),
                btcApiOrigin: this.getString('btcApiOrigin'),
                btcApiToken: this.getString('btcApiToken'),
                ckbNodeUrl: this.getString('ckbNodeUrl'),
                ckbIndexerUrl: this.getString('ckbIndexerUrl'),
                electrsUrl: this.getString('electrsUrl'),
                mempoolUrl: this.getString('mempoolUrl'),
                minMarketFee: this.getNumber('minMarketFee'),
                paymasterAddress: this.getString('paymasterAddress'),
                distributorTimeLockCkbAddress: this.getString('distributorTimeLockCkbAddress'),
                ckbCellCost: this.getNumber('ckbCellCost'),
                mintFee: this.getNumber('mintFee'),
                deployFee: this.getNumber('deployFee'),
                symbolBlacklist: this.getString('symbolBlacklist'),
                launchpadMintFee: this.getNumber('launchpadMintFee'),
                launchpadPaymasterAddress: this.getString('launchpadPaymasterAddress'),
            };
        }
    get ckbCellDisptacherConfig(): {
        ckbCellDispatcherKey: string;
        ckbCellForDeployerSize: number;
    } {
            return {
                ckbCellDispatcherKey: this.getString('ckbCellDispatchKey'),
                ckbCellForDeployerSize: this.getNumber('ckbCellForDeploySize'),
            };
        }
    get ckbExplorerConfig(): {
        host: string;
    } {
            return {
                host: this.getString('ckbExplorerHost'),
            };
        }
    get cmcApiKey(): string {
            return this.getString('cmcApiKey');
        }
    get displacedTokens(): Map<string, string> {
            const displacedTokens = new Map();
            const displacedTokenSymbols = this.getString('displacedTokens')
                .split(',')
                .map((v: any) => v.toLowerCase());
            displacedTokenSymbols.forEach((token: any) => {
                const typeHash = this.getString(`${token}DisplacedTypeHash`);
                if (typeHash !== null && typeHash !== undefined && typeHash !== '') {
                    displacedTokens.set(token, typeHash);
                }
            });
            return displacedTokens;
        }
}
