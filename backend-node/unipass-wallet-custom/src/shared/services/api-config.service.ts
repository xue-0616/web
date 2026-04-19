import { Injectable } from '@nestjs/common';
import cache_manager_redis_store from 'cache-manager-redis-store';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { isNil } from 'lodash';

@Injectable()
export class ApiConfigService {
    constructor(configService: any, logger: any) {
        this.configService = configService;
        this.logger = logger;
        this.logger.setContext(ApiConfigService.name);
    }
    configService: any;
    logger: any;
    get isDevelopment() {
            return this.nodeEnv === 'development';
        }
    get isProduction() {
            return this.nodeEnv === 'production';
        }
    get isTest() {
            return this.nodeEnv === 'test';
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
            return value.replace(/\\n/g, '\n');
        }
    getStringArray(key: any, toLowerCase: any = false) {
            let value = this.get(key);
            if (toLowerCase) {
                value = value.toLowerCase();
            }
            return value.split(',');
        }
    get nodeEnv() {
            return this.getString('NODE_ENV');
        }
    get mysqlConfig() {
            const entities = [__dirname + '/../../modules/**/*.entity{.ts,.js}'];
            const migrations = [__dirname + '/../../database/migrations/*{.ts,.js}'];
            return {
                entities,
                migrations,
                keepConnectionAlive: true,
                type: 'mysql',
                host: this.getString('DB_HOST'),
                port: this.getNumber('DB_PORT'),
                username: this.getString('DB_USERNAME'),
                password: this.getString('DB_PASSWORD'),
                database: this.getString('DB_DATABASE'),
                migrationsRun: true,
                logging: this.getBoolean('ENABLE_ORM_LOGS'),
                namingStrategy: new SnakeNamingStrategy(),
            };
        }
    get redisConfig() {
            return {
                store: cache_manager_redis_store,
                url: this.getString('REDIS_URL'),
                ttl: this.getNumber('REDIS_TTL'),
                auth_pass: this.getString('REDIS_PASSWORD'),
            };
        }
    get documentationEnabled() {
            return this.getBoolean('ENABLE_DOCUMENTATION');
        }
    get getContractConfig() {
            return {
                multicallAddress: this.getString('MULTICALL_ADDRESS'),
                rpcNodeUrl: this.getString('RPC_NODE_URL'),
                genNodeName: this.getString('GEN_CHAIN_NODE_NAME'),
                rpcRelayerUrl: this.getString('RPC_RELAYER_URL'),
                customRelayer: this.getEnvKeyToJson('CUSTOM_RELAYER'),
                nodeName: this.getEnvKeyToJson('NODE_NAME'),
            };
        }
    get queueConfig() {
            return {
                redis: {
                    host: this.getString('REDIS_HOST'),
                    port: this.getNumber('REDIS_PORT'),
                    db: this.getNumber('REDIS_DB'),
                    password: this.getString('REDIS_PASSWORD'),
                },
            };
        }
    get getAdminConfig() {
            return {
                adminAddresses: this.getStringArray('AP_ADMIN_ADDRESS', true),
                relayerAddresses: this.getString('RELAYER_SIG_ADDRESS'),
            };
        }
    get getTssConfig() {
            return {
                host: this.getString('TSS_HOST'),
                privateKey: this.getString('TSS_PRIVATE_KEY'),
            };
        }
    get appConfig() {
            return {
                port: this.getString('PORT'),
                rateLimit: this.getNumber('RATE_Limit'),
                tankTokenChainId: this.getNumber('TANK_TOKEN_CHAIN_ID'),
                tankToken: this.getString('TANK_TOKEN'),
                callbackSigPrivateKey: this.getString('CALLBACK_SIG_PRIVATE_KEY'),
            };
        }
    get jwtConfig() {
            return {
                secret: this.getString('JWT_SECRET_KEY'),
                signOptions: {
                    expiresIn: this.getString('JWT_EXPIRESIN'),
                },
            };
        }
    get getThirdPartyApiConfig() {
            return {
                cmcApiKey: this.getString('CMC_PRO_API_KEY'),
            };
        }
    get(key: any) {
            const value = this.configService.get(key);
            if (isNil(value)) {
                throw new Error(key + ' environment variable does not set');
            }
            return value.trim();
        }
    getEnvKeyToJson(key: any) {
            try {
                const value = this.get(key);
                return JSON.parse(value);
            }
            catch (_a) {
                return {};
            }
        }
}
