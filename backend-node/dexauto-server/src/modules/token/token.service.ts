import { In, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { TokenInfo } from './entities/token-info.entity';
import { ClickHouseService, TokenPrice } from '../../infrastructure/clickhouse/clickhouse.service';
import { TimeRange, TimeInterval } from './constants/time-range.enum';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TokenConfigurationDto } from './dto/configuration.dto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { web3 } from '@coral-xyz/anchor';
import { isEmpty } from 'lodash';
import { v7 } from 'uuid';
import { fetchDigitalAsset, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { getCreatedTimesQuery, getPoolInfoByAddressQuery, getPoolInfoByMintAddressesQuery, getPoolInfoByMintAndPoolQuery, getPoolInfoByMintQuery, getPoolInfoByPoolAddressesQuery, getPoolsInfoByMintQuery, getSolPriceQuery, getTokenHistoryPriceQuery, getTokenTradesInfoQuery, getTokenTradesQuery, getTokenTradesWithPoolQuery, getTokensTradesByMintsQuery, getTokensTradesByPoolAddressesQuery, getTrendingTokensQuery } from './query/clickhouse-query';
import { BadRequestException, UnknownError } from '../../error';
import { TOKEN_2022_PROGRAM_ID, getTokenMetadata } from '@solana/spl-token';
import { USDC, WSOL } from '../../common/utils';

/**
 * Validate that a URL is safe to fetch (SSRF protection).
 * Blocks private/reserved IPs and non-http(s) schemes.
 */
function isSafeUrl(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        // Only allow http and https schemes
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
        }
        const hostname = url.hostname;
        // Block localhost and loopback
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
            return false;
        }
        // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
        const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4Match) {
            const [, a, b] = ipv4Match.map(Number);
            if (a === 10) return false;
            if (a === 172 && b >= 16 && b <= 31) return false;
            if (a === 192 && b === 168) return false;
            if (a === 169 && b === 254) return false; // link-local
            if (a === 0) return false;
        }
        // Block cloud metadata endpoints
        if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export type TokenHistoryPrice = Record<string, any>;
export type TrendingTokenInfo = Record<string, any>;

@Injectable()
export class TokenService {
    private tokenInfoRepository: Repository<TokenInfo>;
    private clickhouse: ClickHouseService;
    private redisClient: Redis;
    private logger: Logger;
    private isUpdating: boolean;
    private processingToken: Map<string, any>;
    private connection: any;
    private umi: any;

    constructor(
        @InjectRepository(TokenInfo) tokenInfoRepository: Repository<TokenInfo>,
        clickhouse: ClickHouseService,
        configService: ConfigService,
        @Inject('REDIS_CLIENT') redisClient: Redis,
    ) {
        this.tokenInfoRepository = tokenInfoRepository;
        this.clickhouse = clickhouse;
        this.redisClient = redisClient;
        this.logger = new Logger(TokenService.name);
        this.isUpdating = false;
        this.processingToken = new Map();
        this.connection = new web3.Connection(configService.getOrThrow('solanaRpcUrl'));
        const umi = createUmi(configService.getOrThrow('solanaRpcUrl'));
        umi.use(mplTokenMetadata());
        this.umi = umi;
    }
    getCacheKey(timeRange: any) {
        const env = process.env.NODE_ENV || 'DEV';
        const prefix = `${env}:DEXAUTO:`;
        return prefix + `TOKEN:TRENDING_TOKENS:${timeRange}`;
    }
    getHoldersCacheKey(mintAddress: any) {
        const env = process.env.NODE_ENV || 'DEV';
        const prefix = `${env}:DEXAUTO:`;
        return prefix + `TOKEN:HOLDERS:${mintAddress}`;
    }
    getSOLCacheKey() {
        const env = process.env.NODE_ENV || 'DEV';
        return `${env}:DEXAUTO:TOKEN:SOL`;
    }
    isTokenComplete(token: any) {
        return token && token.metaDataUri && token.icon && token.audit;
    }
    async getTrendingTokensWithCache(timeRange: any): Promise<any> {
        try {
            const cacheKey = this.getCacheKey(timeRange);
            const trendingTokensJson = await this.redisClient.get(cacheKey);
            const trendingTokens = JSON.parse(trendingTokensJson || '[]');
            if (!trendingTokens) {
                this.logger.log(`Cache ${cacheKey} miss, fetching new data`);
                return [];
            }
            return trendingTokens;
        }
        catch (error) {
            this.logger.error('Error in getTrendingTokensWithCache:', error);
            return [];
        }
    }
    async findByMintAddress(mintAddress: any): Promise<TokenInfo | null> {
        const cleanMintAddress = mintAddress.replace(/\0/g, '');
        return this.tokenInfoRepository.findOne({
            where: { mintAddress: cleanMintAddress },
        });
    }
    async findByMintAddresses(mintAddresses: any): Promise<TokenInfo[]> {
        let tokenInfos = [];
        try {
            tokenInfos = await this.tokenInfoRepository.find({
                where: { mintAddress: In(mintAddresses) },
            });
        }
        catch (error) {
            this.logger.error(`Get token info failed: ${error}`);
            throw new UnknownError(error);
        }
        return tokenInfos;
    }
    async getTokensInfoByAddress(address: string, limit: number): Promise<any> {
        try {
            const tokensTradeInfo = await this.clickhouse.query(getPoolInfoByAddressQuery, { address, limit });
            const tokenInfos = await this.findByMintAddresses(tokensTradeInfo.map((t) => t.base_mint));
            const missingTokenMints = tokensTradeInfo
                .filter((tradeInfo) => !tokenInfos.some((token) => token.mintAddress === tradeInfo.base_mint))
                .map((tradeInfo) => tradeInfo.base_mint);
            const missingTokenInfos = await Promise.all(missingTokenMints.map(async (tokenTradeInfo) => {
                return await this.updateTokenInfo(tokenTradeInfo, null);
            }));
            tokenInfos.push(...missingTokenInfos.filter((tokenInfo) => tokenInfo != null));
            const mappedTokens = tokensTradeInfo.map((tradeInfo) => ({
                ...tokenInfos.find((token) => token.mintAddress === tradeInfo.base_mint),
                ...tradeInfo,
            }));
            return mappedTokens.filter((token) => token.mintAddress);
        }
        catch (e) {
            this.logger.error(`Failed to get tokens info by ${address}: ${e}`);
        }
    }
    async getTokensInfoBySymbol(symbol: string, limit: number): Promise<any> {
        try {
            const tokens = await this.tokenInfoRepository
                .createQueryBuilder('token')
                .where('LOWER(token.symbol) LIKE LOWER(:symbol)', {
                symbol: `%${symbol}%`,
            })
                .getMany();
            this.logger.log(`Tokens info for ${symbol} fetched ${tokens.length} records successfully`);
            const tokensTradeInfo = await this.clickhouse.query(getPoolsInfoByMintQuery, { mints: tokens.map((token) => token.mintAddress), limit });
            this.logger.log(`Trade info fetched ${tokensTradeInfo.length} records successfully`);
            const mappedTokens = tokensTradeInfo.map((tradeInfo) => ({
                ...tokens.find((t) => t.mintAddress === tradeInfo.base_mint),
                ...tradeInfo,
            }));
            return mappedTokens.filter((token) => token.mintAddress);
        }
        catch (error) {
            this.logger.error(`Failed to get tokens info for ${symbol}: ${(error as Error).message}`);
            throw error;
        }
    }
    getPriceHistoryQueryTable(interval: any) {
        switch (interval) {
            case TimeInterval.MIN_1:
                return 'trades_1m_stats';
            case TimeInterval.MIN_5:
                return 'trades_5m_stats';
            case TimeInterval.MIN_15:
                return 'trades_15m_stats';
            case TimeInterval.HOUR_1:
                return 'trades_1h_stats';
            case TimeInterval.HOUR_4:
                return 'trades_4h_stats';
            case TimeInterval.HOUR_24:
                return 'trades_1d_stats';
            default:
                return 'trades_1m_stats';
        }
    }
    formatTokenPriceInfo(tokenPoolInfo: any, tokenTradeInfo: any, mintAddress: any, poolAddress: any) {
        if (tokenPoolInfo.length === 0) {
            this.logger.error(`Failed to get token Pool for ${mintAddress}`);
            throw new BadRequestException(`Failed to get token Pool ${mintAddress}`);
        }
        if (tokenTradeInfo.length === 0) {
            return {
                ...tokenPoolInfo[0],
                price_24h_ago: tokenPoolInfo[0].latest_price,
            };
        }
        if (poolAddress) {
            return { ...tokenPoolInfo[0], ...tokenTradeInfo[0] };
        }
        return { ...tokenTradeInfo[0] };
    }
    async getTokenInfoByMint(mintAddress: string, poolAddress: string | null | undefined): Promise<any> {
        try {
            let tokenInfo = await this.findByMintAddress(mintAddress);
            tokenInfo = await this.updateTokenInfo(mintAddress, tokenInfo);
            let tokenPoolInfos = [];
            let tokenTradeInfo = [];
            if (poolAddress) {
                [tokenPoolInfos, tokenTradeInfo] = await Promise.all([
                    this.clickhouse.query(getPoolInfoByMintAndPoolQuery, {
                        mintAddress,
                        poolAddress,
                    }),
                    this.clickhouse.query(getTokenTradesWithPoolQuery, {
                        mintAddress,
                        poolAddress,
                    }),
                ]);
            }
            else {
                [tokenPoolInfos, tokenTradeInfo] = await Promise.all([
                    this.clickhouse.query(getPoolInfoByMintQuery, {
                        mintAddress,
                    }),
                    this.clickhouse.query(getTokenTradesInfoQuery, {
                        mintAddress,
                    }),
                ]);
            }
            this.logger.log(`Get token info for ${mintAddress} successfully`);
            const tokenPriceInfo = this.formatTokenPriceInfo(tokenPoolInfos, tokenTradeInfo, mintAddress, poolAddress);
            return { ...tokenInfo, ...tokenPriceInfo };
        }
        catch (error) {
            this.logger.error(`Failed to get token info for ${mintAddress}: ${(error as Error).message}`);
            throw error;
        }
    }
    async getTokenPrice(mintAddress: any, poolAddress: any, startTime: any, endTime: any, interval: any): Promise<TokenHistoryPrice[]> {
        try {
            const table = this.getPriceHistoryQueryTable(interval);
            const tokenPrice = await this.clickhouse.query(getTokenHistoryPriceQuery, {
                table: table,
                mintAddress,
                poolAddress,
                startTime,
                endTime,
                interval,
            });
            const availablePrice = tokenPrice.find((price) => price.open_price !== null);
            if (!availablePrice) {
                return [];
            }
            for (let i = 1; i < tokenPrice.length; i++) {
                if (i === 1 && tokenPrice[0].open_price === null) {
                    tokenPrice[0].open_price = availablePrice.open_price;
                    tokenPrice[0].close_price = availablePrice.open_price;
                    tokenPrice[0].high_price = availablePrice.open_price;
                    tokenPrice[0].low_price = availablePrice.open_price;
                }
                tokenPrice[i].open_price = tokenPrice[i - 1].close_price;
                if (tokenPrice[i].close_price === null) {
                    tokenPrice[i].close_price = tokenPrice[i - 1].close_price;
                    tokenPrice[i].high_price = tokenPrice[i - 1].close_price;
                    tokenPrice[i].low_price = tokenPrice[i - 1].close_price;
                }
            }
            return tokenPrice;
        }
        catch (error) {
            this.logger.error(`Failed to get token price for ${mintAddress}: ${(error as Error).message}`);
            return [];
        }
    }
    async updateTokenInfo(mintAddress: any, tokenInfo: any): Promise<TokenInfo | null> {
        let processing = this.processingToken.get(mintAddress);
        if (!processing) {
            processing = this._updateTokenInfo(mintAddress, tokenInfo);
            this.processingToken.set(mintAddress, processing);
        }
        const finalTokenInfo = await processing;
        this.processingToken.delete(mintAddress);
        return finalTokenInfo;
    }
    async _updateTokenInfo(mintAddress: any, tokenInfo: any): Promise<TokenInfo | null> {
        try {
            this.logger.log(`Updating token info for ${mintAddress}`);
            if (!tokenInfo) {
                tokenInfo = new TokenInfo();
                tokenInfo.id = v7();
                tokenInfo.mintAddress = mintAddress;
                tokenInfo.createdAt = new Date();
            }
            if (!tokenInfo.icon) {
                tokenInfo = await this.fetchTokenMetadata(tokenInfo);
                this.logger.log(`Token metadata for ${mintAddress} updated successfully`);
            }
            if (isEmpty(tokenInfo.audit)) {
                tokenInfo.audit = await this.fetchTokenAudit(mintAddress);
                this.logger.log(`Token audit for ${mintAddress} updated successfully`);
            }
            tokenInfo.updatedAt = new Date();
            this.logger.log(`Token info for ${mintAddress} updated successfully`);
            tokenInfo = await this.tokenInfoRepository.save(tokenInfo);
            return tokenInfo;
        }
        catch (error) {
            this.logger.error(`Failed to update token info for ${mintAddress}: ${(error as Error).message}`);
            return tokenInfo;
        }
    }
    getSecondsForTimeRange(timeRange: any) {
        switch (timeRange) {
            case TimeRange.MINS_5:
                return 300;
            case TimeRange.HOUR_1:
                return 3600;
            case TimeRange.HOURS_6:
                return 21600;
            case TimeRange.HOURS_24:
                return 86400;
        }
    }
    async fetchTokenAudit(mintAddress: any) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${mintAddress}`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const data = (await response.json());
            if (data.result[mintAddress]) {
                return data.result[mintAddress];
            }
            this.logger.error({
                message: `Failed to fetch audit for token ${mintAddress}`,
                response: data,
            });
            return {};
        }
        catch (error) {
            this.logger.error(`Failed to fetch audit for ${mintAddress}: ${(error as Error).message}`);
            return {};
        }
    }
    async getMultiTokenHoldersNumber(mintAddresses: any) {
        const holdersMap = new Map();
        try {
            this.logger.log(`start fetch multiToken holders by ${this.connection.rpcEndpoint}`);
            const response = await fetch(this.connection.rpcEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getMultiTokenHoldersNumber',
                    params: [[...mintAddresses]],
                }),
            });
            const data = await response.json();
            if ('error' in data) {
                throw new Error(data.error.message);
            }
            data.result.value.forEach((num: any, index: any) => {
                holdersMap.set(mintAddresses[index], num);
            });
            this.logger.log(`fetch multiToken holders success`);
            return holdersMap;
        }
        catch (error) {
            mintAddresses.forEach((mintAddress: any) => {
                holdersMap.set(mintAddress, 0);
            });
            this.logger.log(`fetch multiToken holders failed: ${error}`);
            return holdersMap;
        }
    }
    async getTokenHoldersNumber(mintAddress: any): Promise<number> {
        try {
            const holders = await this.redisClient.get(this.getHoldersCacheKey(mintAddress));
            if (holders)
                return Number(holders);
            const response = await fetch(this.connection.rpcEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTokenHoldersNumber',
                    params: [mintAddress],
                }),
            });
            const data = await response.json();
            if ('error' in data) {
                throw new Error(data.error.message);
            }
            if (data.result.value > 5000) {
                await this.redisClient.set(this.getHoldersCacheKey(mintAddress), data.result.value.toString(), 'EX', 600);
            }
            return data.result.value;
        }
        catch (error) {
            this.logger.log(`fetch token ${mintAddress} holders failed: ${error}`);
            return 0;
        }
    }
    async getTokenTopHolders(mintAddress: any, limit: any): Promise<any> {
        try {
            this.logger.log(`start fetch token ${mintAddress} top holders ${limit} by ${this.connection.rpcEndpoint}`);
            const response = await fetch(this.connection.rpcEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTokenTopHolders',
                    params: [mintAddress, limit],
                }),
            });
            const data = await response.json();
            if ('error' in data) {
                throw new Error(data.error.message);
            }
            return data.result.value;
        }
        catch (error) {
            this.logger.log(`fetch token ${mintAddress} holders failed: ${error}`);
            return [];
        }
    }
    async fetchTokenMetadata(tokenInfo: any) {
        try {
            if (!tokenInfo.metaDataUri) {
                const mint = new web3.PublicKey(tokenInfo.mintAddress);
                const { value: { amount: supply, decimals }, } = await this.connection.getTokenSupply(mint);
                tokenInfo.supply = supply;
                tokenInfo.decimals = decimals;
                const accountInfo = await this.connection.getAccountInfo(mint);
                let metadata;
                if (accountInfo?.owner.toString() === TOKEN_2022_PROGRAM_ID.toString()) {
                    metadata = await getTokenMetadata(this.connection, new web3.PublicKey(tokenInfo.mintAddress));
                }
                else {
                    const asset = await fetchDigitalAsset(this.umi, publicKey(tokenInfo.mintAddress));
                    metadata = asset.metadata;
                }
                if (metadata) {
                    tokenInfo.metaDataUri = metadata.uri;
                    tokenInfo.symbol = metadata.symbol;
                    tokenInfo.name = metadata.name;
                }
            }
            if (tokenInfo.metaDataUri) {
                if (!isSafeUrl(tokenInfo.metaDataUri)) {
                    this.logger.warn(`Blocked unsafe metadata URL for ${tokenInfo.mintAddress}: ${tokenInfo.metaDataUri}`);
                    return tokenInfo;
                }
                const response = await fetch(tokenInfo.metaDataUri, { signal: AbortSignal.timeout(10_000) });
                const data = (await response.json());
                tokenInfo.icon = data.image;
                tokenInfo.socials = data.extensions;
            }
            return tokenInfo;
        }
        catch (error) {
            this.logger.warn(`Failed to fetch metadata for ${tokenInfo.mintAddress}: ${(error as Error).message}`);
            return tokenInfo;
        }
    }
    async getTrendingTokens(timeRange = TimeRange.HOURS_24, limit = 100): Promise<TrendingTokenInfo[]> {
        try {
            const seconds = this.getSecondsForTimeRange(timeRange);
            const MIN_SAFE_TOKENS = 50;
            const MAX_OFFSET = 1000;
            let offset = 0;
            let hasMore = true;
            let safeTokens: any[] = [];
            while (hasMore && safeTokens.length < MIN_SAFE_TOKENS) {
                const params = {
                    seconds,
                    limit,
                    offset,
                };
                const trendingTokens = await this.clickhouse.query(getTrendingTokensQuery, params);
                hasMore = trendingTokens.length === limit;
                if (trendingTokens.length === 0) {
                    break;
                }
                this.logger.log(`Trending tokens fetched ${trendingTokens.length} successfully`);
                const poolsSet = new Set();
                const tokensMap = new Map();
                trendingTokens.forEach((token) => {
                    poolsSet.add(token.pool_address);
                    tokensMap.set(token.base_mint, token);
                });
                const poolAddresses = Array.from(poolsSet);
                const mintAddresses = Array.from(tokensMap.keys());
                const [poolsTradeInfo, createdTimes, tokensInfo] = await Promise.all([
                    this.clickhouse.query(getTokensTradesByPoolAddressesQuery, {
                        poolAddresses,
                    }),
                    this.clickhouse.query(getCreatedTimesQuery, {
                        poolAddresses,
                    }),
                    this.findByMintAddresses(mintAddresses),
                ]);
                const trendingTokensInfo = mintAddresses.map((mintAddress) => {
                    const token = tokensMap.get(mintAddress);
                    const tradeInfo = poolsTradeInfo.find((pool) => pool.pool_address === token.pool_address);
                    const createdAt = createdTimes.find((time) => time.pool_address === token.pool_address)?.createdTime || null;
                    // Use optional chaining — tradeInfo can be undefined when the pool is
                    // brand-new or materialized views haven't caught up; without guarding
                    // this the entire trending query would crash on a single missing row.
                    return {
                        ...tokensMap.get(mintAddress),
                        price_5m_ago: tradeInfo?.price_5m_ago,
                        price_1h_ago: tradeInfo?.price_1h_ago,
                        price_6h_ago: tradeInfo?.price_6h_ago,
                        price_24h_ago: tradeInfo?.price_24h_ago,
                        createdAt: createdAt ? Number(createdAt) * 1000 : null,
                        tokenInfo: tokensInfo.find((info) => info.mintAddress === mintAddress) ||
                            null,
                    };
                });
                let holdersMap = new Map();
                const holders = await Promise.all(mintAddresses.map(async (mintAddress) => {
                    return await this.getTokenHoldersNumber(mintAddress);
                }));
                holders.forEach((holders, index) => {
                    holdersMap.set(mintAddresses[index], holders);
                });
                this.logger.log(`Holders for ${mintAddresses.length} tokens fetched successfully`);
                const results = await Promise.allSettled(trendingTokensInfo.map(async (token) => {
                    try {
                        if (!this.isTokenComplete(token.tokenInfo)) {
                            token.tokenInfo = await this.updateTokenInfo(token.base_mint, token.tokenInfo);
                        }
                        return { holders: holdersMap.get(token.base_mint), ...token };
                    }
                    catch (error) {
                        this.logger.warn(`Failed to process token ${token.base_mint}: ${(error as Error).message}`);
                        throw error;
                    }
                }));
                const validResults = results
                    .filter((result) => result.status === 'fulfilled')
                    .map((result) => result.value);
                const newSafeTokens = validResults.filter((token) => {
                    const audit = token.tokenInfo?.audit;
                    return audit?.freezable?.status === '0';
                });
                safeTokens = [...safeTokens, ...newSafeTokens];
                offset += limit;
                if (offset > MAX_OFFSET) {
                    this.logger.warn('Reached max query limit finding trending tokens');
                    break;
                }
            }
            safeTokens = safeTokens.slice(0, MIN_SAFE_TOKENS);
            // Cache with TTL (10 min) instead of forever. Without a TTL the trending
            // cache would be stale indefinitely if the cron fails, and users would
            // see the same "trending" tokens for days.
            await this.redisClient.setex(this.getCacheKey(timeRange), 600, JSON.stringify(safeTokens));
            this.logger.log(`Set cache success ${this.getCacheKey(timeRange)} for ${safeTokens.length} records`);
            return safeTokens;
        }
        catch (error) {
            this.logger.error(`Error in getTrendingTokens: ${String(error)}`);
            throw error;
        }
    }
    async getTokensByPoolAddresses(poolAddresses: string[]): Promise<any> {
        try {
            this.logger.log(`Start to get tokens by pool addresses`);
            const [pools, tokensTradeInfo, createdTimes] = await Promise.all([
                this.clickhouse.query(getPoolInfoByPoolAddressesQuery, {
                    poolAddresses,
                }),
                this.clickhouse.query(getTokensTradesByPoolAddressesQuery, {
                    poolAddresses,
                }),
                this.clickhouse.query(getCreatedTimesQuery, {
                    poolAddresses,
                }),
            ]);
            this.logger.log('getTokensByPoolAddresses fetched successfully');
            const mintAddresses = pools.map((pool) => pool.base_mint);
            const tokensInfo = await this.findByMintAddresses(mintAddresses);
            const tokens = pools.map((pool) => {
                const tradeInfo = tokensTradeInfo.find((trade) => trade.pool_address === pool.pool_address);
                const tokenInfo = tokensInfo.find((token) => token.mintAddress === pool.base_mint);
                const createdAt = createdTimes.find((time) => time.pool_address === pool.pool_address)
                    ?.createdTime || null;
                return {
                    ...pool,
                    tokenInfo,
                    createdAt: createdAt ? Number(createdAt) * 1000 : null,
                    price_5m_ago: tradeInfo?.price_5m_ago,
                    price_1h_ago: tradeInfo?.price_1h_ago,
                    price_6h_ago: tradeInfo?.price_6h_ago,
                    price_24h_ago: tradeInfo?.price_24h_ago ?? pool.latest_price,
                    timeRange: {
                        m5: {
                            volume: tradeInfo?.volume_5m ?? 0,
                            sell_count: tradeInfo?.sell_count_5m ?? 0,
                            buy_count: tradeInfo?.buy_count_5m ?? 0,
                        },
                        h1: {
                            volume: tradeInfo?.volume_1h ?? 0,
                            sell_count: tradeInfo?.sell_count_1h ?? 0,
                            buy_count: tradeInfo?.buy_count_1h ?? 0,
                        },
                        h6: {
                            volume: tradeInfo?.volume_6h ?? 0,
                            sell_count: tradeInfo?.sell_count_6h ?? 0,
                            buy_count: tradeInfo?.buy_count_6h ?? 0,
                        },
                        h24: {
                            volume: tradeInfo?.volume_24h ?? 0,
                            sell_count: tradeInfo?.sell_count_24h ?? 0,
                            buy_count: tradeInfo?.buy_count_24h ?? 0,
                        },
                    },
                };
            });
            return tokens;
        }
        catch (error) {
            this.logger.error({
                message: 'Error in getTokensByPoolAddresses',
                error,
            });
            throw error;
        }
    }
    async getTokensByMintAddresses(mintAddresses: string[]): Promise<any> {
        try {
            const [tokensTradeInfo, pools, tokensInfo] = await Promise.all([
                this.clickhouse.query(getTokensTradesByMintsQuery, {
                    mintAddresses,
                }),
                this.clickhouse.query(getPoolInfoByMintAddressesQuery, {
                    mintAddresses,
                }),
                this.findByMintAddresses(mintAddresses),
            ]);
            const poolAddresses = pools.map((pool) => pool.pool_address);
            const createdTimes = await this.clickhouse.query(getCreatedTimesQuery, {
                poolAddresses,
            });
            const tokens = pools.map((pool) => {
                const tradeInfo = tokensTradeInfo.find((trade) => trade.pool_address === pool.pool_address);
                const tokenInfo = tokensInfo.find((tokenInfo) => pool.base_mint === tokenInfo.mintAddress);
                const createdAt = createdTimes.find((created) => created.pool_address === pool.pool_address)?.createdTime || null;
                const finalPool = tradeInfo
                    ? {
                        base_mint: tradeInfo.base_mint,
                        pool_address: tradeInfo.pool_address,
                        base_vault_balance: tradeInfo.base_vault_balance,
                        quote_vault_balance: tradeInfo.quote_vault_balance,
                        latest_price: tradeInfo.latest_price,
                    }
                    : pool;
                return {
                    tokenInfo,
                    ...finalPool,
                    latest_price: tradeInfo?.latest_price ?? finalPool.latest_price,
                    createdAt: createdAt ? Number(createdAt) * 1000 : null,
                    price_5m_ago: tradeInfo?.price_5m_ago,
                    price_1h_ago: tradeInfo?.price_1h_ago,
                    price_6h_ago: tradeInfo?.price_6h_ago,
                    price_24h_ago: tradeInfo?.price_24h_ago ?? finalPool.latest_price,
                    timeRange: {
                        m5: {
                            volume: tradeInfo?.volume_5m ?? 0,
                            sell_count: tradeInfo?.sell_count_5m ?? 0,
                            buy_count: tradeInfo?.buy_count_5m ?? 0,
                        },
                        h1: {
                            volume: tradeInfo?.volume_1h ?? 0,
                            sell_count: tradeInfo?.sell_count_1h ?? 0,
                            buy_count: tradeInfo?.buy_count_1h ?? 0,
                        },
                        h6: {
                            volume: tradeInfo?.volume_6h ?? 0,
                            sell_count: tradeInfo?.sell_count_6h ?? 0,
                            buy_count: tradeInfo?.buy_count_6h ?? 0,
                        },
                        h24: {
                            volume: tradeInfo?.volume_24h ?? 0,
                            sell_count: tradeInfo?.sell_count_24h ?? 0,
                            buy_count: tradeInfo?.buy_count_24h ?? 0,
                        },
                    },
                };
            });
            return tokens;
        }
        catch (error) {
            this.logger.error(`Error in getTokensByMintAddresses: ${error}`);
            throw error;
        }
    }
    async getTokenTrades(mintAddress: any, poolAddress: any, startTime: any, limit: any, offset: any): Promise<Record<string, any>[]> {
        try {
            const trades = await this.clickhouse.query(getTokenTradesQuery, {
                mintAddress,
                poolAddress,
                startTime,
                limit,
                offset,
            });
            return trades;
        }
        catch (e) {
            this.logger.error(`Error in getTokenTrades ${poolAddress}: ${e}`);
            return [];
        }
    }
    async _solPrice(): Promise<TokenPrice> {
        const solPoolPrice = await this.clickhouse.query(getSolPriceQuery);
        if (solPoolPrice.length) {
            const cacheKey = this.getSOLCacheKey();
            this.redisClient.set(cacheKey, JSON.stringify(solPoolPrice[0]));
            return new TokenPrice({
                poolAddress: solPoolPrice[0].pool_address,
                baseMint: WSOL,
                quoteMint: USDC,
                baseVaultBalance: solPoolPrice[0].base_vault_balance,
                quoteVaultBalance: solPoolPrice[0].quote_vault_balance,
                latestPrice: solPoolPrice[0].latest_price,
            });
        }
        throw new UnknownError(`Get sol price failed`);
    }
    async solPrice(): Promise<TokenPrice> {
        const cacheKey = this.getSOLCacheKey();
        const solPriceJson = await this.redisClient.get(cacheKey);
        if (solPriceJson) {
            try {
                const solPrice = JSON.parse(solPriceJson);
                return new TokenPrice({
                    poolAddress: solPrice.pool_address,
                    baseMint: WSOL,
                    quoteMint: USDC,
                    baseVaultBalance: solPrice.base_vault_balance,
                    quoteVaultBalance: solPrice.quote_vault_balance,
                    latestPrice: solPrice.latest_price,
                });
            }
            catch (e) {
                throw new UnknownError(`Parse sol cache failed`);
            }
        }
        return this._solPrice();
    }
    async _tokenPrices(mintAddresses: any): Promise<TokenPrice[]> {
        const [poolsPrice, tokensTradePrice, solPrice] = await Promise.all([
            this.clickhouse.query(getPoolInfoByMintAddressesQuery, {
                mintAddresses,
            }),
            this.clickhouse.query(getPoolsInfoByMintQuery, {
                mints: mintAddresses,
                limit: mintAddresses.length,
            }),
            this.solPrice(),
        ]);
        // ClickHouse returns Decimal columns as strings, so `!== 0` always evaluates
        // true (since `"0" !== 0`). Null prices would also slip through and crash
        // the `new Decimal(null)` call inside TokenPrice. Use an explicit positive
        // check that tolerates string/number/Decimal inputs.
        const isPositivePrice = (v: any): boolean => {
            if (v === null || v === undefined) return false;
            try {
                const d = new Decimal(v);
                return d.isFinite() && d.gt(0);
            } catch {
                return false;
            }
        };
        return mintAddresses
            .map((mintAddress: any) => {
            if (mintAddress === WSOL)
                return solPrice;
            let tradePrice = tokensTradePrice.find((token) => token.base_mint === mintAddress);
            let poolPrice = poolsPrice.find((pool) => pool.base_mint === mintAddress);
            if (tradePrice && isPositivePrice(tradePrice.latest_price)) {
                return new TokenPrice({
                    poolAddress: tradePrice.pool_address,
                    baseMint: tradePrice.base_mint,
                    quoteMint: WSOL,
                    baseVaultBalance: tradePrice.base_vault_balance,
                    quoteVaultBalance: tradePrice.quote_vault_balance,
                    latestPrice: tradePrice.latest_price,
                });
            }
            if (poolPrice && isPositivePrice(poolPrice.latest_price)) {
                return new TokenPrice({
                    poolAddress: poolPrice.pool_address,
                    baseMint: poolPrice.base_mint,
                    quoteMint: WSOL,
                    baseVaultBalance: poolPrice.base_vault_balance,
                    quoteVaultBalance: poolPrice.quote_vault_balance,
                    latestPrice: poolPrice.latest_price,
                });
            }
            this.logger.error(`Get price for ${mintAddress} failed, got ${tradePrice?.latest_price || poolPrice?.latest_price}, mintAddresses: ${JSON.stringify(mintAddresses)}`);
            return undefined;
        })
            .filter((v: any) => v !== undefined);
    }
    async configurations(): Promise<TokenConfigurationDto> {
        const tokenPrices = await this._tokenPrices([WSOL]);
        const solPrice = tokenPrices[0];
        if (!solPrice) {
            this.logger.error('cannot get sol price');
            throw new UnknownError('cannot get sol price');
        }
        return {
            solPrice: solPrice.latestPrice.toFixed(),
        };
    }
    async updateTrendingTokens(): Promise<void> {
        if (this.isUpdating) {
            this.logger.log('Another update is in progress, skipping...');
            return;
        }
        try {
            this.logger.log('Updating trending tokens...');
            this.isUpdating = true;
            await Promise.all([
                this.getTrendingTokens(TimeRange.MINS_5),
                this.getTrendingTokens(TimeRange.HOUR_1),
                this.getTrendingTokens(TimeRange.HOURS_6),
                this.getTrendingTokens(TimeRange.HOURS_24),
            ]);
            this.logger.log('Trending tokens updated successfully');
        }
        catch (error) {
            this.logger.error('Failed to update trending tokens:', error);
        }
        finally {
            this.isUpdating = false;
        }
    }
}
