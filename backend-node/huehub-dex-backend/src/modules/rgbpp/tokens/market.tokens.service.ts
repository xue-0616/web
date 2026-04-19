import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TokenEntity, TokenStatus } from '../../../database/entities/token.entity';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { In, Repository } from 'typeorm';
import { TokenType, TokensInfoInput, TokensInput } from '../dto/tokens.input.dto';
import { TokenInfoDto } from '../dto/tokens.output.dto';
import Decimal from 'decimal.js';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import { BtcService } from '../../btc/btc.service';
import Redis from 'ioredis';
import { TokenStatisticService } from './token.statistic.service';
import { UsdPrice } from '../../../common/interface/mempool.dto';
import { ItemService } from '../order/item.service';
import { SearchTokensOutput } from '../dto/search.tokens.output.dto';
import { TIME } from '../../../common/utils/const.config';
import { convertTokenPriceToUSDPrice, getUSDValueForSatoshi } from '../../../common/utils/tools';
import { StatusName } from '../../../common/utils/error.code';

@Injectable()
export class MarketTokensService {
    constructor(private readonly appConfig: AppConfigService, private readonly logger: AppLoggerService, private readonly btcPrice: BtcService, @InjectRepository(TokenEntity) private tokenRepository: Repository<TokenEntity>, private readonly itemService: ItemService, @InjectRedis() private readonly redis: Redis, private readonly tokenStatisticService: TokenStatisticService) {
        this.logger.setContext(MarketTokensService.name);
    }
    getMarketKeyCacheKey(token_type: TokenType, page: number, limit: number): string {
            return `${this.appConfig.nodeEnv}:Hue:Hub:User:Tokens:${token_type}_${page}_${limit}{tag}`;
        }
    getMarketOneTokenKeyCacheKey(token_type: TokenType, id: number | undefined, xudtTypeHash: string | undefined): string {
            return `${this.appConfig.nodeEnv}:Hue:Hub:User:Tokens:${token_type}_${id}_${xudtTypeHash}{tag}`;
        }
    async getAllStaticTokens(): Promise<TokenEntity[]> {
            return await this.tokenRepository.find({
                where: { status: TokenStatus.Listing },
            });
        }
    async findInitializeStatisticsTokens(tokenId: number[]): Promise<TokenEntity[]> {
            let where = tokenId.length > 0
                ? { status: TokenStatus.Listing, id: In(tokenId) }
                : { status: TokenStatus.Listing };
            return await this.tokenRepository.find({
                where,
            });
        }
    async getTokenInfos(tokenType: TokenType, page: number, limit: number, tokenId?: number, xudtTypeHash?: string): Promise<TokenInfoDto[]> {
            let queryBuilder = this.tokenRepository
                .createQueryBuilder('token')
                .where('token.status = :status', {
                status: TokenStatus.Listing,
            });
            if (page === 0 && limit > 1) {
                queryBuilder.andWhere('token.id != :sealTokenId', { sealTokenId: 1 });
                limit -= 1;
            }
            if (tokenId) {
                queryBuilder = queryBuilder.andWhere('token.id = :tokenId', { tokenId });
            }
            if (xudtTypeHash) {
                queryBuilder = queryBuilder.andWhere('token.xudtTypeHash = x:xudtTypeHash', {
                    xudtTypeHash: xudtTypeHash.replace('0x', ''),
                });
            }
            if (tokenType == TokenType.Hot && limit > 1) {
                queryBuilder = queryBuilder
                    .andWhere('token.lastVolume > :zero AND token.floorPrice > :zero', {
                    zero: 0,
                })
                    .orderBy({
                    'token.lastVolume': 'DESC',
                    'token.marketCap': 'DESC',
                    'token.id': 'ASC',
                });
            }
            else {
                queryBuilder = queryBuilder.leftJoinAndSelect('token.deploymentToken', 'deploy');
                if (limit > 1) {
                    queryBuilder = queryBuilder
                        .andWhere('token.deploymentTokenId > :zero', {
                        zero: 0,
                    })
                        .orderBy({
                        'deploy.mintedAmount': 'DESC',
                        'token.deployedTime': 'ASC',
                        'token.id': 'ASC',
                    });
                }
            }
            queryBuilder.limit(limit).offset(page * limit);
            let rawResults = [];
            if (page === 0 && limit > 1) {
                let [sealResults, tokensRawResults] = await Promise.all([
                    this.getSealTokenInfo(tokenType),
                    queryBuilder.getRawMany(),
                ]);
                rawResults = sealResults.concat(tokensRawResults);
            }
            else {
                rawResults = await queryBuilder.getRawMany();
            }
            let list = rawResults.map((x) => {
                let startBlock = 0;
                let lockedBtcAge = 0;
                let mintedAmount = '0';
                let issuedAt = x.token_created_at
                    ? x.token_created_at.getTime() / 1000
                    : x.created_at / 1000;
                let progressRate = new Decimal(1);
                let floorPrice = new Decimal(0);
                let lockedBtcAmounts = [];
                if (x.deploy_locked_btc_amounts) {
                    lockedBtcAmounts = x.deploy_locked_btc_amounts.split(',');
                }
                if (x.deploy_btc_tx_block_height && x.deploy_relative_start_block) {
                    startBlock =
                        parseInt(x.deploy_btc_tx_block_height) +
                            parseInt(x.deploy_relative_start_block);
                }
                if (x.deploy_amount_per_mint && x.deploy_minted_amount) {
                    mintedAmount = new Decimal(x.deploy_amount_per_mint)
                        .mul(new Decimal(x.deploy_minted_amount))
                        .toFixed(8);
                }
                if (x.deploy_deployed_time) {
                    issuedAt = x.deploy_deployed_time.getTime() / 1000;
                }
                if (x.deploy_minted_ratio) {
                    progressRate = new Decimal(x.deploy_minted_ratio);
                }
                if (x.deploy_locked_btc_age) {
                    lockedBtcAge = new Decimal(x.deploy_locked_btc_age).toNumber();
                }
                if (x.token_floor_price) {
                    floorPrice = new Decimal(x.token_floor_price);
                }
                let data = {
                    id: parseInt(x.token_id),
                    iconUrl: x.token_icon_url ? x.token_icon_url : x.icon_image_data,
                    name: x.token_name,
                    symbol: x.token_symbol,
                    xudtTypeHash: `0x${x.token_xudt_type_hash.toString('hex')}`,
                    xudtArgs: `0x${x.token_xudt_args.toString('hex')}`,
                    xudtCodeHash: `0x${x.token_xudt_code_hash.toString('hex')}`,
                    progressRate,
                    showMintButton: progressRate >= new Decimal(1) ? false : true,
                    supply: x.total_supply ? x.total_supply : x.token_total_supply,
                    startBlock,
                    mintedAmount,
                    issuedAt,
                    paymasterAddress: x.deploy_paymaster_address
                        ? x.deploy_paymaster_address
                        : '',
                    price: floorPrice.toFixed(8),
                    volume: x.token_last_volume,
                    holders: x.token_last_holders,
                    sales: x.token_last_sales,
                    tokenDecimal: x.token_decimals,
                    lockedBtcAge,
                    lockedBtcAmounts,
                    perMintAmount: x.deploy_amount_per_mint
                        ? x.deploy_amount_per_mint
                        : '0',
                    ckbCellCost: this.appConfig.rgbPPConfig.ckbCellCost,
                    mintFee: this.appConfig.rgbPPConfig.mintFee,
                };
                return data;
            });
            return list as any;
        }
    async getSealTokenInfo(tokenType: TokenType): Promise<TokenInfoDto[]> {
            let queryBuilder = this.tokenRepository
                .createQueryBuilder('token')
                .where('token.status = :status and token.id = :tokenId', {
                status: TokenStatus.Listing,
                tokenId: 1,
            });
            if (tokenType == TokenType.Mint) {
                queryBuilder = queryBuilder.leftJoinAndSelect('token.deploymentToken', 'deploy');
            }
            queryBuilder.limit(1).offset(0);
            return await queryBuilder.getRawMany();
        }
    async getMarketTokens(query: TokensInput): Promise<any> {
            const key = this.getMarketKeyCacheKey(query.tokenType, query.page, query.limit);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            if (!query.tokenType) {
                query.tokenType = TokenType.Hot;
            }
            try {
                console.time('aa');
                let [btcUsdPrice, tokens] = await Promise.all([
                    this.btcPrice.getBtcPrice(),
                    this.getTokenInfos(query.tokenType, query.page, query.limit),
                ]);
                console.timeEnd('aa');
                console.time('bb');
                let list = await this.packageTokenInfo(tokens, btcUsdPrice, query.tokenType, false);
                console.timeEnd('bb');
                if (list.length > 0) {
                    await this.redis.set(key, JSON.stringify(list), 'EX', TIME.TEN_SECOND);
                }
                return list;
            }
            catch (error) {
                this.logger.error(`[getMarketTokens] ${(error as Error)?.stack}`);
                return [];
            }
        }
    async packageTokenInfo(tokens: TokenInfoDto[], btcUsdPrice: UsdPrice, tokenType: TokenType, showTotal: boolean): Promise<TokenInfoDto[]> {
            let tokenIds = tokens.map((x) => x.id);
            let tokenStatic: any[] = [];
            console.time('cc');
            if (tokenType === TokenType.Hot) {
                tokenStatic = await this.tokenStatisticService.getStatisticFrom24HoursAgo(tokenIds, true);
            }
            console.timeEnd('cc');
            let totalVolume = '0';
            if (showTotal) {
                const staticToken = await this.tokenStatisticService.getLastTokenStatistic({
                    tokenId: tokenIds[0],
                });
                if (staticToken) {
                    totalVolume = staticToken.volume.toString();
                }
            }
            let list = await Promise.all(tokens.map(async (x) => {
                let lastPrice = new Decimal(x.price);
                let lastHolders = new Decimal(x.holders);
                let btcPriceInUsd = new Decimal(btcUsdPrice.USD);
                x.usdPrice = convertTokenPriceToUSDPrice(lastPrice, btcPriceInUsd).toFixed(4);
                const marketCap = new Decimal(x.supply)
                    .div(Decimal.pow(10, x.tokenDecimal))
                    .mul(x.price);
                x.usdMarketCap = getUSDValueForSatoshi(marketCap, btcPriceInUsd).toFixed(4);
                x.marketCap = marketCap.toFixed(4);
                if (showTotal) {
                    x.volume = totalVolume;
                }
                if (tokenType === TokenType.Hot) {
                    let cacheStatic = tokenStatic.find((stats) => stats.tokenId === x.id);
                    this.logger.log(`[packageTokenInfo] ${x.id} cacheStatic is  ${JSON.stringify(cacheStatic)}`);
                    if (cacheStatic) {
                        let floorPrice = new Decimal(cacheStatic.floorPrice);
                        x.change = lastPrice.minus(floorPrice).div(floorPrice).toFixed(8);
                        let cacheHolders = new Decimal(cacheStatic.holders);
                        x.holdersChange = lastHolders
                            .minus(cacheHolders)
                            .div(cacheHolders)
                            .toFixed(8);
                        x.sales = new Decimal(x.sales).minus(cacheStatic.sales).toString();
                    }
                    else {
                        x.change = '0';
                        x.holdersChange = '0';
                    }
                }
                x.usdVolume = getUSDValueForSatoshi(new Decimal(x.volume), btcPriceInUsd).toFixed(4);
                return x;
            }));
            return list;
        }
    async getOneMarketToken(query: TokensInfoInput): Promise<TokenInfoDto> {
            const key = this.getMarketOneTokenKeyCacheKey(TokenType.Mint, query.id, query.xudtTypeHash);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            try {
                let [btcUsdPrice, tokens] = await Promise.all([
                    this.btcPrice.getBtcPrice(),
                    this.getTokenInfos(TokenType.Mint, 0, 1, query.id, query.xudtTypeHash),
                ]);
                if (tokens.length === 0) {
                    this.logger.error('[getOneMarketToken] token info not find');
                    throw new BadRequestException(StatusName.ParameterException);
                }
                let list = await this.packageTokenInfo(tokens, btcUsdPrice, TokenType.Mint, true);
                if (list.length > 0) {
                    await this.redis.set(key, JSON.stringify(list[0]), 'EX', TIME.TEN_SECOND);
                }
                return list[0];
            }
            catch (error) {
                this.logger.error(`[getOneMarketToken] ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
        }
    async getOneTokenInfo(query: TokensInfoInput): Promise<[TokenEntity, Decimal]> {
            try {
                let token = await this.tokenRepository.findOne({
                    where: query.id
                        ? { id: query.id }
                        : { xudtTypeHash: (query.xudtTypeHash ?? '').replace('0x', '') },
                });
                if (!token) {
                    this.logger.error('[getTokenInfo] token not find');
                    throw new BadRequestException(StatusName.ParameterException);
                }
                let item = await this.itemService.getMinimalFloorPriceItem(token.id);
                if (!item) {
                    return [token, new Decimal(0)];
                }
                return [token, item.pricePerToken];
            }
            catch (error) {
                return [null as any, new Decimal(0)];
            }
        }
    searchTokensCacheKey(key: any) {
            return `${this.appConfig.nodeEnv}:Hue:Hub:User:SercheTokens:${key}{tag}`;
        }
    async retrieveCachedSearchTokens(sercheKey: string): Promise<SearchTokensOutput | null> {
            let key = this.searchTokensCacheKey(sercheKey);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            return null;
        }
    async storeSearchTokensInCache(sercheKey: string, data: SearchTokensOutput): Promise<void> {
            let key = this.searchTokensCacheKey(sercheKey);
            await this.redis.set(key, JSON.stringify(data), 'EX', TIME.TEN_SECOND);
        }
    async searchTokens(xudtTypeHash: string, symbol: string, limit: number = 10): Promise<TokenEntity[]> {
            let queryBuilder = this.tokenRepository
                .createQueryBuilder('token')
                .where('token.status = :status', {
                status: TokenStatus.Listing,
            });
            if (xudtTypeHash) {
                queryBuilder = queryBuilder.andWhere('token.xudtTypeHash = x:xudtTypeHash', {
                    xudtTypeHash: xudtTypeHash.replace('0x', ''),
                });
            }
            if (symbol) {
                queryBuilder = queryBuilder
                    .andWhere('token.lowercaseSymbol LIKE :lowercaseSymbol', {
                    lowercaseSymbol: `%${symbol.toLowerCase()}%`,
                })
                    .orderBy('token.lowercaseSymbol');
            }
            queryBuilder.limit(limit);
            return await queryBuilder.getMany();
        }
}
