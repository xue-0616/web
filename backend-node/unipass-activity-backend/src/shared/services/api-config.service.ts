import { Injectable } from '@nestjs/common';
import cache_manager_redis_store from 'cache-manager-redis-store';
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
            return value.replace(/\\n/g, '\n');
        }
    get nodeEnv() {
            return this.getString('NODE_ENV');
        }
    get fallbackLanguage() {
            return this.getString('FALLBACK_LANGUAGE').toLowerCase();
        }
    get getPolygonScanConfig() {
            return {
                apiKey: this.getString('POLYGONSCAN_API_KEY'),
                host: this.getString('POLYGONSCAN_API_HOST'),
            };
        }
    get redisConfig(): any {
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
    get activityConfig() {
            return {
                adminKey: this.getString('ACTIVITY_ADMIN_PRIVATE_KEY'),
                openApiHost: this.getString('UNIPASS_OPENAPI_HOST'),
                entrypointAddress: this.getString('ENTRUYPOINT_ADDRESS'),
            };
        }
    get getContractConfig() {
            return {
                genNodeUrl: this.getString('GEN_NODE_URL'),
                isMainNet: this.getBoolean('IS_MAIN_NET'),
            };
        }
    get appConfig() {
            return {
                port: this.getString('PORT'),
                rateLimit: this.getNumber('RATE_LIMIT'),
            };
        }
    get(key: any) {
            const value = this.configService.get(key);
            if (isNil(value)) {
                throw new Error(key + ' environment variable does not set');
            }
            return value;
        }
}
