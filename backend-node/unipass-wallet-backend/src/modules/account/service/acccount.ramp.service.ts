import { Injectable } from '@nestjs/common';
import moment from 'moment';
import querystringify from 'querystringify';
import { RampPlatform } from '../dto';
import { binanceApiGetSign, getBinanceConnectNetworkByChainId, getNetworkByChainId, signatureAlchemyPay, signatureFatPay, sortRequestParameters } from '../../../shared/utils';

@Injectable()
export class AccountRampService {
    constructor(logger: any, apiConfigService: any, redisService: any, upHttpService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.redisService = redisService;
        this.upHttpService = upHttpService;
        this.logger.setContext(AccountRampService.name);
    }
    logger: any;
    apiConfigService: any;
    redisService: any;
    upHttpService: any;
    getOnRampUrl(account: any, getOnRampUrlInput: any) {
            const { address, email, provider } = account;
            const { chain, platform } = getOnRampUrlInput;
            let url = '';
            this.logger.log(`[getAlchemyPayUrl] from ${email}_${provider} get on ramp url.
          address = ${address} network =${chain} platform =${platform}`);
            switch (platform) {
                case RampPlatform.AlchemyPay:
                    url = this.getAlchemyPayUrl(address, email, chain);
                    break;
                case RampPlatform.FatPay:
                    url = this.getFatPayUrl(address, chain);
                    break;
                case RampPlatform.WhaleFin:
                    break;
                case RampPlatform.BinanceConnect:
                    url = this.getBinanceConnectIframeUrl(address, chain);
                    break;
                default:
                    break;
            }
            return { url };
        }
    getAlchemyPayUrl(address: any, email: any, network: any) {
            const host = this.apiConfigService.getOnOffRampConfig.alchemyPayHost;
            const appId = this.apiConfigService.getOnOffRampConfig.alchemyPayAppId;
            const secretKey = this.apiConfigService.getOnOffRampConfig.alchemyPaySercetKey;
            const param = {
                address,
                appId,
            };
            getNetworkByChainId(network);
            const requestParameters = sortRequestParameters(param);
            const sign = signatureAlchemyPay(secretKey, requestParameters);
            const parameters = Object.assign(Object.assign({}, requestParameters), { sign,
                email });
            const url = `${host}${querystringify.stringify(parameters, true)}`;
            return url;
        }
    getFatPayUrl(address: any, cryptoNetwork: any) {
            const host = this.apiConfigService.getOnOffRampConfig.fatPayHost;
            const partnerId = this.apiConfigService.getOnOffRampConfig.fatPayPartnerId;
            const secretKey = this.apiConfigService.getOnOffRampConfig.fatPaySecretKey;
            const timestamp = moment().unix();
            const param = {
                walletAddress: address,
                walletAddressHidden: 1,
                walletAddressLocked: 1,
                partnerId,
                timestamp,
                nonce: timestamp,
            };
            const requestParameters = sortRequestParameters(param);
            const signature = signatureFatPay(secretKey, requestParameters);
            const parameters = Object.assign(Object.assign({}, requestParameters), { signature,
                cryptoNetwork });
            if (!parameters.cryptoNetwork) {
                delete parameters.cryptoNetwork;
            }
            const url = `${host}${querystringify.stringify(parameters, true)}`;
            return url;
        }
    getBinanceConnectIframeUrl(address: any, network: any) {
            const host = this.apiConfigService.getOnOffRampConfig.binanceConnectHost;
            const merchantCode = this.apiConfigService.getOnOffRampConfig.binanceConnectMerchantCode;
            const privateKey = this.apiConfigService.getOnOffRampConfig.binancePrivateKey;
            const timestamp = moment().valueOf();
            getBinanceConnectNetworkByChainId(network);
            const param = {
                cryptoAddress: address,
                merchantCode,
                timestamp,
            };
            const requestParameters = sortRequestParameters(param);
            const signature = binanceApiGetSign(requestParameters, privateKey);
            const parameters = Object.assign(Object.assign({}, requestParameters), { signature });
            const url = `${host}/en/pre-connect${querystringify.stringify(parameters, true)}`;
            return url;
        }
}
