import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { MyHttpService } from '../../common/utils-service/http.service';
import Redis from 'ioredis';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { ShowTokenInfoInputDto } from './dto/show-token-info.input.dto';
import { TokenInfoOutput } from './dto/show-token-info.output.dto';
import { AddressTransfersInputDto } from './dto/address-transfers.input.dto';
import { AddressTransfersOutput } from './dto/address-transfers.output.dto';
import { TIME } from '../../common/utils/time';
import { stringify } from 'querystringify';

@Injectable()
export class SolanaService {
    constructor(private readonly myHttpService: MyHttpService, private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(SolanaService.name);
    }
    getTokenInfoKey() {
            return `${this.appConfig.nodeEnv}:Solagram:Token:Info:{tag}`;
        }
    async cacheTokenInfo(addresses: string[]): Promise<any> {
            let url = `${this.appConfig.solanaFmConfig.host}/v1/tokens`;
            let config = {
                headers: {
                    ApiKey: this.appConfig.solanaFmConfig.apiKey,
                    accept: 'application/json',
                    'content-type': 'application/json',
                },
            };
            let body = { tokens: addresses };
            let data = await this.myHttpService.httpPost(url, body, config);
            if (!data) {
                return {};
            }
            let key = this.getTokenInfoKey();
            await this.redis.set(key, JSON.stringify(data), 'EX', TIME.DAY);
            return data;
        }
    async getTokenInfo(input: ShowTokenInfoInputDto): Promise<TokenInfoOutput> {
            const uniqueAddresses = Array.from(new Set(input.addresses));
            const addressSet = new Set(uniqueAddresses);
            const key = this.getTokenInfoKey();
            const cacheData = await this.redis.get(key);
            if (!cacheData) {
                const data = await this.cacheTokenInfo(uniqueAddresses);
                return data;
            }
            const cachedTokens = JSON.parse(cacheData);
            const cachedFilteredTokens = Object.entries(cachedTokens)
                .filter(([tokenHash]) => addressSet.has(tokenHash))
                .reduce((acc, [tokenHash, tokenInfo]) => {
                acc[tokenHash] = tokenInfo;
                return acc;
            }, {});
            if (Object.keys(cachedFilteredTokens).length === uniqueAddresses.length) {
                return cachedFilteredTokens;
            }
            const newTokenInfo = await this.cacheTokenInfo(uniqueAddresses);
            const allTokens = { ...cachedTokens, ...newTokenInfo };
            await this.redis.set(key, JSON.stringify(allTokens), 'EX', TIME.DAY);
            return newTokenInfo;
        }
    getTransfersInfoKey(key: any) {
            return `${this.appConfig.nodeEnv}:Solagram:Address:Transfer:${key}:{tag}`;
        }
    async getAddressTransfers(input: AddressTransfersInputDto): Promise<AddressTransfersOutput> {
            let { address, page, mint } = input;
            const limit = 30;
            const key = this.getTransfersInfoKey(`${address}_${page}_${mint}_${limit}`);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            const utcFrom = Math.floor(new Date(this.appConfig.solanaFmConfig.solanaFmApiUtcFrom).getTime() /
                1000);
            const utcTo = Math.floor(new Date().getTime() / 1000);
            const host = this.appConfig.solanaFmConfig.host;
            let param = mint
                ? { page, mint, limit, utcFrom, utcTo }
                : { page, limit, utcFrom, utcTo };
            let url = `${host}/v0/accounts/${address}/transfers${stringify(param, true)}`;
            let config = {
                headers: {
                    ApiKey: this.appConfig.solanaFmConfig.apiKey,
                },
            };
            let data = await this.myHttpService.httpGet(url, config);
            if (data) {
                await this.redis.set(key, JSON.stringify(data), 'EX', TIME.TEN_SECOND);
            }
            return data;
        }
}
