import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { isNil } from 'lodash';

@Injectable()
export class ApiConfigService {
    configService;
    constructor(configService: ConfigService) {
        this.configService = configService;
    }
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
            throw new Error(key + ' environment variable is not a number');
        }
    }
    getBoolean(key: any) {
        const value = this.get(key);
        try {
            return Boolean(JSON.parse(value));
        }
        catch (error) {
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
    get getContractConfig() {
        return {
            multicallAddress: this.getString('MULTICALL_ADDRESS'),
            updateOpenIdAddress: this.getString('UPDATE_OPENID_ADDRESS'),
            updateDkimAddress: this.getString('UPDATE_DKIM_KEYS_ADDRESS'),
            rpcNodeUrl: this.getString('RPC_NODE_URL'),
            genNodeName: this.getString('GEN_CHAIN_NODE_NAME'),
            bscNodeName: this.getString('BSD_CHAIN_NODE_NAME'),
            ethNodeName: this.getString('ETH_CHAIN_NODE_NAME'),
            rangersNodeNmae: this.getString('RANGERS_CHAIN_NODE_NAME'),
            genTestnetNodeName: this.getString('GEN_CHAIN_NODE_NAME_TESTNET'),
            bscTestnetNodeName: this.getString('BSD_CHAIN_NODE_NAME_TESTNET'),
            ethTestnetNodeName: this.getString('ETH_CHAIN_NODE_NAME_TESTNET'),
            rangersTestnetNodeNmae: this.getString('RANGERS_CHAIN_NODE_NAME_TESTNET'),
            eoaPrivateKey: this.getString('EOA_PRIVATE_KEY'),
        };
    }
    get getApConfig() {
        return {
            adminPrivateKey: this.getString('AP_ADMIN_PRIVATE_KEY'),
        };
    }
    get cmcConfig() {
        return {
            key: this.getString('CMC_PRO_API_KEY'),
        };
    }
    getOpenIdConfig(): {
        googleIss: string;
        googleCertsUrl: string;
        authUniPassIss: string;
        authUniPassCertsUrl: string;
    } {
        return {
            googleIss: this.getString('GOOGLE_ISS'),
            googleCertsUrl: this.getString('GOOGLE_CERTS_URL'),
            authUniPassIss: this.getString('AUTH_UNIPASS_ISS'),
            authUniPassCertsUrl: this.getString('AUTH_UNIPASS_CERTS_URL'),
        };
    }
    getDkimConfig(): {
        openIdName: string;
        googleIss: string;
        googleCertsUrl: string;
        authUniPassIss: string;
        authUniPassCertsUrl: string;
    } {
        return {
            openIdName: this.getString('OPEN_ID_NAME'),
            googleIss: this.getString('GOOGLE_ISS'),
            googleCertsUrl: this.getString('GOOGLE_CERTS_URL'),
            authUniPassIss: this.getString('AUTH_UNIPASS_ISS'),
            authUniPassCertsUrl: this.getString('AUTH_UNIPASS_CERTS_URL'),
        };
    }
    get getOnOffRampConfig() {
        return {
            fatPayPrivateKey: this.getString('FAT_PAY_PRIVATE_KEY'),
            fatPayPartnerId: this.getString('FAT_PAY_PARTNER_Id'),
            slackWebHookUrl: this.getString('SLACK_WEB_HOOK_URL'),
        };
    }
    get getPolygonScanConfig() {
        return {
            apiKey: this.getString('POLYGONSCAN_API_KEY'),
            host: this.getString('POLYGONSCAN_API_HOST'),
        };
    }
    get getElasticConfig() {
        return {
            username: this.getString('ELASTIC_USERNAME'),
            password: this.getString('ELASTIC_PASSWORD'),
            nodes: this.getString('ELASTIC_NODES'),
            logIndex: this.getString('ELASTIC_LOGS_INDEX'),
        };
    }
    get SnapAppConfig() {
        return {
            SnapAppId: this.getString('SNAP_APP_ID'),
            PaymentAppId: this.getString('UNIPASS_APP_APP_ID'),
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
