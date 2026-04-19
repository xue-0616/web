import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModuleOptions } from '@nestjs-modules/ioredis';
import { AppLoggerService } from './logger.service';
import { BullRootModuleOptions } from '@nestjs/bull';
import { JwtModuleOptions } from '@nestjs/jwt';
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
                const e = error as Error;
                this.logger.error(`[getNumber] ${e},${e?.stack} data = ${JSON.stringify({
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
                const e = error as Error;
                this.logger.error(`[getBoolean] ${e},${e?.stack} data = ${JSON.stringify({
                    key,
                })}`);
                throw new Error(key + ' env var is not a boolean');
            }
        }
    getString(key: any) {
            const value = this.get(key);
            return value.replace(/\\n/g, '\n').trim();
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
    get tgBotInfo(): {
        walletBotToken: string;
        token: string;
        username: string;
        appName: string;
    } {
            return {
                walletBotToken: this.getString('tgWalletBotToken'),
                token: this.getString('tgBotToken'),
                username: this.getString('botUsername'),
                appName: this.getString('appName'),
            };
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
    get walletConfig(): {
        solanaApi: string;
    } {
            return {
                solanaApi: this.getString('solanaApi'),
            };
        }
    get webhookConfig(): {
        hostname: string;
        secretToken: string;
        maxConnections: number;
    } {
            return {
                hostname: this.getString('hostname'),
                secretToken: this.getString('secretToken'),
                maxConnections: this.getNumber('maxConnections'),
            };
        }
    get jwtConfig(): JwtModuleOptions {
            return {
                privateKey: this.getString('jwtPrivateKey'),
                signOptions: {
                    algorithm: 'RS256',
                    expiresIn: this.getString('jwtExpiresIn'),
                    keyid: this.getString('jwtKeyId'),
                },
            };
        }
    get awsConfig(): {
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        userPoolId: string;
        userPoolClientId: string;
        userPoolClientSercet: string;
        userPoolPassword: string;
        identityPoolId: string;
        kmsKeyId: string;
    } {
            return {
                region: this.getString('awsRegion'),
                accessKeyId: this.getString('awsAccessKeyId'),
                secretAccessKey: this.getString('awsSecretAccessKey'),
                userPoolId: this.getString('awsUserPoolId'),
                userPoolClientId: this.getString('awsUserPoolClientId'),
                userPoolClientSercet: this.getString('awsUserPoolClientSercet'),
                userPoolPassword: this.getString('awsUserPoolPassword'),
                identityPoolId: this.getString('awsIdentityPoolId'),
                kmsKeyId: this.getString('awsKmsKeyId'),
            };
        }
    get solanaFmConfig(): { host: string; apikey: string; apiKey: string; solanaFmApiUtcFrom: string } {
            return {
                host: this.getString('solanaFmHost'),
                apikey: this.getString('solanaFmApikey'),
                apiKey: this.getString('solanaFmApikey'),
                solanaFmApiUtcFrom: this.getString('solanaFmApiUtcFrom'),
            };
        }
}
