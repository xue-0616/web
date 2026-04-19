import { Injectable } from '@nestjs/common';
import { TIME, filterErc20List, getAlchemyNodename, getPolicyData, getPolicyEoaAddress, snapSuffixes, suffixes } from '../utils';
import { Weight } from '../../mock/weight';
import { Keyset, RoleWeight } from '@unipasswallet/keys';

@Injectable()
export class UnipassConfigService {
    constructor(logger: any, apiConfigService: any, redisService: any, upHttpService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.redisService = redisService;
        this.upHttpService = upHttpService;
        this.logger.setContext(UnipassConfigService.name);
    }
    logger: any;
    apiConfigService: any;
    redisService: any;
    upHttpService: any;
    getConfig(suffixesInput: any) {
            const { isSnap } = suffixesInput;
            const emailSuffixes = isSnap === 'true' ? [...suffixes, ...snapSuffixes] : suffixes;
            const weight = new Weight();
            const policyWeight = weight.getPolicyWeight();
            const policyData = getPolicyData(new RoleWeight(policyWeight.ownerWeight, policyWeight.assetsOpWeight, policyWeight.guardianWeight));
            const policyAddress = getPolicyEoaAddress();
            const keyset = new Keyset([policyData]);
            const config = {
                suffixes: emailSuffixes,
                policyAddress,
                policyKeysetJson: keyset.toJson(),
            };
            return config;
        }
    isTestWhiteList(email: any) {
            const isAllowWhiteList = this.apiConfigService.testConfig.allowWhiteLisrt;
            if (!isAllowWhiteList) {
                return isAllowWhiteList;
            }
            const whiteList = this.apiConfigService.testConfig.white;
            return whiteList.includes(email);
        }
    async getPriceConversion(getPriceConversionInput: any) {
            let { id } = getPriceConversionInput;
            const ids = id.split(',');
            const tokenData: Record<string, any> = {};
            const queryIds: any[] = [];
            for (const item of ids) {
                const idKey = `price_${item}`;
                const idTokenCache = await this.redisService.getCacheData(idKey);
                if (idTokenCache) {
                    const idTokenData = idTokenCache;
                    tokenData[item] = idTokenData;
                }
                else {
                    queryIds.push(item);
                }
            }
            if (queryIds.length === 0) {
                return tokenData;
            }
            id = queryIds.join(',').trim();
            if (!id) {
                return tokenData;
            }
            const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${id}`;
            const key = `price_${id}`;
            const priceCache = await this.redisService.getCacheData(key);
            if (priceCache) {
                return priceCache;
            }
            const config = {
                headers: {
                    'X-CMC_PRO_API_KEY': this.apiConfigService.cmcConfig.key,
                },
            };
            const reqData = await this.upHttpService.httpGet(url, config);
            if (!reqData) {
                return {};
            }
            const data = reqData.data;
            for (const keyId in data) {
                const idKey = `price_${keyId}`;
                const coin = data[keyId];
                await this.redisService.saveCacheData(idKey, coin, TIME.ONE_MINUTE * 10);
            }
            return data;
        }
    async getNodeRealTokenHoldings(address: any) {
            let list: any[] = [];
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.getNodeRealApiKey;
            const url = `https://bsc-mainnet.nodereal.io/v1/${apiKey}`;
            const parameters = {
                jsonrpc: '2.0',
                method: 'nr_getTokenHoldings',
                params: [address, '0x1', '0x64'],
                id: 1,
            };
            this.logger.log(`[httpPost] ${url} parameters = ${JSON.stringify(parameters)}`);
            const data = (await this.upHttpService.httpPost(url, parameters));
            if (!data || data.error) {
                return list;
            }
            const tokenList = data.result.details;
            if (tokenList) {
                list = filterErc20List(tokenList);
            }
            return list;
        }
    async getAlchemyErc20Token(address: any, chainId: any) {
            let list: any[] = [];
            const apiKey = this.apiConfigService.getThirdPartyApiConfig.getAlchemyApiKey;
            const nodeName = getAlchemyNodename(chainId);
            if (!nodeName) {
                return list;
            }
            const url = `https://${nodeName}.g.alchemy.com/v2/${apiKey}`;
            const parameters = {
                id: 1,
                jsonrpc: '2.0',
                method: 'alchemy_getTokenBalances',
                params: [address, 'erc20'],
            };
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            this.logger.log(`[httpPost] ${url} parameters = ${JSON.stringify(parameters)}`);
            const data = (await this.upHttpService.httpPost(url, parameters, config));
            if (!data) {
                return list;
            }
            const tokenLIst = data.result.tokenBalances;
            list = filterErc20List(tokenLIst);
            return list;
        }
    async getAccountErc20Tokens(getAccountTokensInput: any) {
            const { chainIds, address } = getAccountTokensInput;
            if (chainIds.length === 0) {
                return [];
            }
            const tokenList = [];
            for (const item of chainIds) {
                const chainId = `${item}`;
                const key = `${address}:${chainId}:tokens`;
                const tokens = await this.redisService.getCacheData(key);
                if (tokens) {
                    tokenList.push(JSON.parse(tokens));
                    continue;
                }
                const bscChainId = ['56', '97'];
                const tokenData = await (bscChainId.includes(chainId)
                    ? this.getNodeRealTokenHoldings(address)
                    : this.getAlchemyErc20Token(address, chainId));
                const balance = '0x0';
                const data = { chainId: item, data: tokenData, balance };
                await this.redisService.saveCacheData(key, JSON.stringify(data), 10);
                tokenList.push(data);
            }
            return tokenList;
        }
}
