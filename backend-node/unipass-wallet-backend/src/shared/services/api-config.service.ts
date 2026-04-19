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
            return value.replace(/\\n/g, '\n').trim();
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
    get fallbackLanguage() {
            return this.getString('FALLBACK_LANGUAGE').toLowerCase();
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
    get tssMysqlConfig() {
            return {
                keepConnectionAlive: true,
                type: 'mysql',
                host: this.getString('TSS_DB_HOST'),
                port: this.getNumber('TSS_DB_PORT'),
                username: this.getString('TSS_DB_USERNAME'),
                password: this.getString('TSS_DB_PASSWORD'),
                database: this.getString('TSS_DB_DATABASE'),
                migrationsRun: true,
                logging: this.getBoolean('ENABLE_ORM_LOGS'),
                namingStrategy: new SnakeNamingStrategy(),
            };
        }
    get awsConfig() {
            return {
                userPoolClientId: this.getString('AWS_CLIENT_ID'),
                userPoolClientSecret: this.getString('AWS_CLIENT_SECRET'),
                userPoolId: this.getString('AWS_USER_POOL_ID'),
                identityPoolId: this.getString('AWS_IDENTITY_POOL_ID'),
                userPoolPassword: this.getString('AWS_USER_POOL_PASSWORD'),
                region: this.getString('AWS_REGION'),
                secretAccessKey: this.getString('AWS_SECRET_ACCESS_KEY'),
                accessKey: this.getString('AWS_ACCESS_KEY_ID'),
                kmsKeyId: this.getString('AWS_KMS_KEY_ID'),
                tssKmsKeyId: this.getString('TSS_KMS_KEY_ID'),
                tssSecretKey: this.getString('TSS_AWS_SECRET_KEY'),
                tssAccessKey: this.getString('TSS_AWS_ACCESS_KEY'),
                tssRegion: this.getString('TSS_AWS_REGION'),
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
    get documentationEnabled() {
            return this.getBoolean('ENABLE_DOCUMENTATION');
        }
    get getOtpConfig() {
            return {
                minOtpCode: this.getNumber('MIN_OTPCODE_INTERVAL'),
                mailFrom: this.getString('MAIL_FROM'),
                subjectPrefix: this.getString('MAIL_SUBJECT_PREFIX'),
                botMail: this.getString('BOT_MAIL'),
                maxTime: this.getNumber('SEND_MAX_TIME'),
                maxVerifyTime: this.getNumber('VERIFY_MAX_TIME'),
                apiHostUrl: this.getString('API_HOST_URL'),
                guardianUrl: this.getString('EMAIL_VERIFY_SUCCESS_URL'),
                showCaptcha: this.getNumber('SHOW_CAPTCHA_TIMES'),
                ipMaxRequest: this.getNumber('MAX_IP_SEND_TIMES'),
            };
        }
    get getGoogelConfig() {
            return {
                siteKey: this.getString('GOOGLE_SITE_KEY'),
            };
        }
    get getWebAuthnConfig() {
            return {
                rpId: this.getString('RP_ID'),
            };
        }
    get getContractConfig() {
            return {
                multicallAddress: this.getString('MULTICALL_ADDRESS'),
                rpcRelayerUrl: this.getString('RPC_RELAYER_URL'),
                zkUrl: this.getString('ZK_HOST'),
                rpcNodeUrl: this.getString('RPC_NODE_URL'),
                genNodeName: this.getString('GEN_CHAIN_NODE_NAME'),
                bscNodeName: this.getString('BSD_CHAIN_NODE_NAME'),
                ethNodeName: this.getString('ETH_CHAIN_NODE_NAME'),
                scrollNodeName: this.getString('SCROLL_CHAIN_NODE_NAME'),
                arbitrumNodeName: this.getString('ARBITRUM_NODE_NAME'),
                platonNodeName: this.getString('PLATON_NODE_NAME'),
                okcNodeName: this.getString('OKC_NODE_NAME'),
                kccNodeName: this.getString('KCC_NODE_NAME'),
                avalancheNodeName: this.getString('AVALANCHE_NODE_NAME'),
                rangersNodeNmae: this.getString('RANGERS_CHAIN_NODE_NAME'),
                privateKey: this.getString('PRIVATE_KEY'),
                policyAddress: this.getString('POLICY_ADDRESS'),
                isMainNet: this.getBoolean('IS_MAIN_NET'),
            };
        }
    get getApConfig() {
            return {
                apTxPrivateKey: this.getString('AP_TX_PRIVATE_KEY'),
                adminAddresses: this.getStringArray('AP_ADMIN_ADDRESS', true),
                apToUsdExchangeRate: this.getNumber('AP_TO_USD_EXCHANGE_RATE'),
                decimal: this.getNumber('AP_DECIMAL'),
            };
        }
    get getRecoveryConfig() {
            return {
                completeTime: this.getNumber('COMPLETE_RECOVERY_TIME'),
            };
        }
    get getSendGridConfig() {
            return {
                apikey: this.getString('SENDGRID_API_KEY'),
            };
        }
    get getEmailNotifyConfig() {
            return {
                siginUrl: this.getString('FRONT_SIGN_IN_URL'),
            };
        }
    get getTwilioAuthConfig() {
            return {
                token: this.getString('TWILIO_AUTH_TOKEN'),
                accountSid: this.getString('TWILIO_ACCOUNT_SID'),
                serverSid: this.getString('TWILIO_SERVICE_SID'),
            };
        }
    get getSMSConfig() {
            return {
                url: this.getString('HY_SMS_URL'),
                userid: this.getString('HY_SMS_USERID'),
                account: this.getString('HY_SMS_ACCOUNT'),
                password: this.getString('HY_SMS_PASSWORD'),
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
                kmsSources: this.getStringArray('SUPPORT_KMS_SOURCE'),
                migrateAppInfo: this.getEnvKeyToJson('MIGRATE_APP_ID_SOURCE'),
            };
        }
    get cmcConfig() {
            return {
                key: this.getString('CMC_PRO_API_KEY'),
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
    get auth0Config() {
            return {
                authODomain: this.getString('AUTH0_DOMAIN'),
            };
        }
    get getOnOffRampConfig() {
            return {
                fatPayHost: this.getString('FAT_PAY_HOST'),
                fatPayPartnerId: this.getString('FAT_PAY_PARTNER_Id'),
                fatPaySecretKey: this.getString('FAT_PAY_SECRET_KEY'),
                alchemyPayHost: this.getString('ALCHEMY_PAY_HOST'),
                alchemyPayAppId: this.getString('ALCHEMY_PAY_APP_ID'),
                alchemyPaySercetKey: this.getString('ALCHEMY_PAY_APP_SECRET_KEY'),
                whaleFinAccessKey: this.getString('WHALE_FIN_ACCESS_KEY'),
                whaleFinAccessSecret: this.getString('WHALE_FIN_ACCESS_SECRET'),
                binanceConnectHost: this.getString('BINANCE_CONNECT_HOST'),
                binancePrivateKey: this.getString('BINANCE_CONNECT_PRIVATE_KEY'),
                binanceConnectMerchantCode: this.getString('BINANCE_CONNECT_MERCHANT_CODE'),
            };
        }
    get testConfig() {
            return {
                allowWhiteLisrt: this.getBoolean('ALLOW_WHITE_LIST'),
                white: this.getString('TEST_WHITE_LIST'),
            };
        }
    get getThirdPartyApiConfig() {
            return {
                getNodeRealApiKey: this.getString('NODEREAL_API_KEY'),
                getAlchemyApiKey: this.getString('ALCHEMY_API_KEY'),
                openSeaApiKey: this.getString('OPEN_SEA_API_KEY'),
                nftScanApiKey: this.getString('NFT_SCAN_API_KEY'),
                cloudflareSecretKey: this.getString('CLOUDFLARE_SECRET_KEY'),
                loaAppId: this.getString('LOA_APP_ID'),
                loaAppName: this.getString('LOA_APP_NAME'),
            };
        }
    get(key: any) {
            const value = this.configService.get(key);
            if (isNil(value)) {
                throw new Error(key + ' environment variable does not set');
            }
            return value.trim();
        }
    getEnvKey(key: any) {
            const value = this.configService.get(key);
            return value ? value.trim() : '';
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
