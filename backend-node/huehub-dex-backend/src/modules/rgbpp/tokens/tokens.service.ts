import { Cron } from '@nestjs/schedule';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { TokensInfoInput, TokensInput } from '../dto/tokens.input.dto';
import { TokenInfoDto, TokensOutputDto } from '../dto/tokens.output.dto';
import { TokenStatisticService } from './token.statistic.service';
import Decimal from 'decimal.js';
import { TokenEntity, TokenStatus } from '../../../database/entities/token.entity';
import { BtcService } from '../../btc/btc.service';
import { ShowUtxoStatus, TokenInfo, UTXOInfo } from '../../user/dto/assets.output.dto';
import { AccountTokenOutpointList } from '../dto/rgbpp.indexer.dto';
import { ItemService } from '../order/item.service';
import { ActivitiesInputDto, ActivityType } from '../dto/activities.input.dto';
import { ActivitiesOutput, ActivitiesOutputDto } from '../dto/activities.output.dto';
import { ItemEntity, ItemStatus } from '../../../database/entities/item.entity';
import { UsdPrice } from '../../../common/interface/mempool.dto';
import { HoldersInputDto } from '../dto/holders.input.dto';
import { HolderListOutputDto } from '../dto/holders.output.dto';
import { RgbPPIndexerService } from '../indexer.service';
import { OrderPendingInputDto } from '../dto/order.pending.input.dto';
import { OrderPendingOutputDto } from '../dto/order.pending.output.dto';
import { StaticsTimeType, TokensStatisticInput } from '../dto/tokens-statistic.input.dto';
import { TokenStatisticInfo, TokensStatisticOutputDto } from '../dto/tokens-statistic.output.dto';
import { MarketTokensService } from './market.tokens.service';
import { SearchTokensInput } from '../dto/search.tokens.input.dto';
import { SearchTokensOutput } from '../dto/search.tokens.output.dto';
import { CkbExplorerApiService } from '../ckb/ckb.explorer.api.service';
import { ExplorerData } from '../../../common/interface/ckb.explorer.api';
import Redis from 'ioredis';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import { TokenStatisticEntity } from '../../../database/entities/token.statistic.entity';
import { RedlockService } from '../../../common/utils-service/redlock.service';
import { StatusName } from '../../../common/utils/error.code';
import { convertTokenPriceToUSDPrice, itemStatusToShowItemStatus } from '../../../common/utils/tools';
import { Between, In } from 'typeorm';
import { TIME } from '../../../common/utils/const.config';
import moment from 'moment';

@Injectable()
export class TokensService {
    constructor(private readonly appConfig: AppConfigService, private readonly rgbPpIndexerService: RgbPPIndexerService, private readonly tokenStaticService: TokenStatisticService, private readonly logger: AppLoggerService, private readonly btcPrice: BtcService, private readonly redlockService: RedlockService, readonly itemService: ItemService, private readonly marketTokensService: MarketTokensService, private readonly ckbExplorerApiService: CkbExplorerApiService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(TokensService.name);
        this.syncAPITokenData();
    }
    async getAllTokens(query: TokensInput): Promise<TokensOutputDto> {
            let data = { tokenList: [] };
            data.tokenList = await this.marketTokensService.getMarketTokens(query);
            return data;
        }
    async getTokenInfoById(query: TokensInfoInput): Promise<TokenInfoDto> {
            if (!query.id && !query.xudtTypeHash) {
                this.logger.error('[getTokenInfoById] tokenId and xudtTypeHash not find ');
                throw new BadRequestException(StatusName.ParameterException);
            }
            let data = await this.marketTokensService.getOneMarketToken(query);
            return data;
        }
    async searchTokens(searchTokensInput: SearchTokensInput): Promise<SearchTokensOutput> {
            let { searchKey } = searchTokensInput;
            let xudtTypehash = null;
            let symbol = null;
            if (searchKey.startsWith('0x') && searchKey.trim().length == 66) {
                xudtTypehash = searchKey.trim();
            }
            else if (searchKey.trim().length < 10) {
                symbol = searchKey.trim();
            }
            else {
                this.logger.error(`[searchTokens] searchKey not match`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            let cacheDate = await this.marketTokensService.retrieveCachedSearchTokens(searchKey);
            if (cacheDate) {
                return cacheDate;
            }
            let tokens = await this.marketTokensService.searchTokens(xudtTypehash ?? '', symbol ?? '');
            const tokenIds = tokens.map((token) => token.id);
            const tokenStatic = await this.tokenStaticService.getStatisticFrom24HoursAgo(tokenIds, true);
            let list = tokens.map((token) => {
                let cacheStatic = tokenStatic.find((stats) => stats.tokenId === token.id);
                let change = '0';
                this.logger.log(`[searchTokens] ${token.id} cacheStatic is ${JSON.stringify(cacheStatic)}`);
                if (cacheStatic) {
                    let floorPrice = new Decimal(cacheStatic.floorPrice);
                    change = token.floorPrice.minus(floorPrice).div(floorPrice).toFixed(8);
                }
                let searchtokenInfo = {
                    id: token.id,
                    iconUrl: token.iconUrl,
                    name: token.name,
                    symbol: token.symbol,
                    tokenDecimal: token.decimals,
                    xudtTypeHash: token.xudtTypeHash,
                    xudtArgs: token.xudtArgs,
                    xudtCodeHash: token.xudtCodeHash,
                    price: token.floorPrice.toString(),
                    change,
                };
                return searchtokenInfo;
            });
            const data: any = { list };
            await this.marketTokensService.storeSearchTokensInCache(searchKey, data);
            return data;
        }
    renderOneTokenInfo(tokenEntity: TokenEntity, pricePerToken: Decimal, amount: Decimal, btcUsd: UsdPrice, utxoCount: number = 0): TokenInfo {
            return {
                id: tokenEntity.id,
                iconUrl: tokenEntity.iconUrl,
                name: tokenEntity.name,
                symbol: tokenEntity.symbol,
                xudtArgs: tokenEntity.xudtArgs,
                xudtCodeHash: tokenEntity.xudtCodeHash,
                xudtTypeHash: tokenEntity.xudtTypeHash,
                pricePerToken: pricePerToken.toFixed(8),
                amount: amount.toString(),
                tokenDecimal: tokenEntity.decimals,
                usdPricePerToken: convertTokenPriceToUSDPrice(pricePerToken, new Decimal(btcUsd.USD)).toFixed(4),
                utxoCount,
            };
        }
    renderUtxosStatus(tokenOutpoints: AccountTokenOutpointList, items: ItemEntity[]): UTXOInfo[] {
            return tokenOutpoints.list.map((utxo): any => {
                let utxoInfo: any = {
                    txHash: utxo.btcOutPoint.txHash,
                    index: utxo.btcOutPoint.index,
                    value: utxo.btcValue,
                    tokenAmount: utxo.amount,
                    status: ShowUtxoStatus.LiveUtxo,
                };
                const item = items.find((x) => x.txHash === utxoInfo.txHash && x.index === utxoInfo.index);
                if (item) {
                    (utxoInfo.status =
                        item.status == ItemStatus.Init
                            ? ShowUtxoStatus.ListUtxo
                            : ShowUtxoStatus.ListPendingUtox),
                        (utxoInfo.itemId = item.id);
                }
                return utxoInfo;
            });
        }
    async getActivities(activitiesInputDto: ActivitiesInputDto): Promise<ActivitiesOutputDto> {
            let tokenEntity = await this.tokenStaticService.getTokenEntityByIdOrTypeHash(activitiesInputDto.tokenId, activitiesInputDto.xudtTypeHash);
            if (!tokenEntity) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            activitiesInputDto.tokenId = tokenEntity.id;
            let [items, total] = await this.itemService.queyActivities(activitiesInputDto);
            const btcPrice = await this.btcPrice.getBtcPrice();
            const itemList = (await Promise.all(items.map((x) => this.getActivityInfo(x, btcPrice)))).filter(Boolean);
            return { list: itemList, total };
        }
    async getActivityInfo(item: ItemEntity, btcPrice: UsdPrice): Promise<ActivitiesOutput> {
            const usdPricePerToken = convertTokenPriceToUSDPrice(item.pricePerToken, new Decimal(btcPrice.USD)).toFixed(4);
            const totalUsdPrice = convertTokenPriceToUSDPrice(item.price, new Decimal(btcPrice.USD)).toFixed(4);
            let type;
            if (item.isCancel) {
                type = ActivityType.Unlist;
            }
            else if (item.status == ItemStatus.Init) {
                type = ActivityType.List;
            }
            else if (item.status == ItemStatus.Invalid) {
                type = ActivityType.Transfer;
            }
            else {
                type = ActivityType.Sale;
            }
            return {
                type,
                id: item.id,
                from: item.sellerAddress,
                name: item.token.name,
                symbol: item.token.symbol,
                totalPrice: item.price.toString(),
                totalUsdPrice,
                pricePerToken: item.pricePerToken.toString(),
                usdPricePerToken,
                tokenAmount: item.tokenAmount.toString(),
                status: itemStatusToShowItemStatus(item.status),
                tokenDecimal: item.token.decimals,
                createdTime: Math.floor(item.updatedAt.getTime() / 1000),
                to: item.buyerAddress,
                btcTxHash: item.order ? item.order.btcTxHash : null,
                ckbTxHash: item.order ? item.order.ckbTxHash : null,
            };
        }
    async getHolders(holderInput: HoldersInputDto): Promise<HolderListOutputDto> {
            let { tokenId, page, limit, xudtTypeHash } = holderInput;
            let tokenEntity = await this.tokenStaticService.getTokenEntityByIdOrTypeHash(tokenId, xudtTypeHash);
            if (!tokenEntity) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            let holder = await this.rgbPpIndexerService.getTokenHolders(tokenEntity.xudtTypeHash, page, limit);
            if (!holder) {
                return { list: [] };
            }
            let list = holder.list.map((x) => {
                return {
                    address: x.address,
                    tokenAmount: x.amount,
                    ratio: x.ratio,
                    name: tokenEntity.name,
                    symbol: tokenEntity.symbol,
                    tokenDecimal: tokenEntity.decimals,
                };
            });
            return { list };
        }
    async getOrderPending(activitiesPending: OrderPendingInputDto): Promise<OrderPendingOutputDto> {
            let [items, total] = await this.itemService.queyPendingActivities(activitiesPending);
            let list = items.map((x) => {
                let itemIds = x.items.map((x) => x.id);
                return {
                    orderId: x.id,
                    buyerAddress: x.buyerAddress,
                    ckbTx: x.ckbTx,
                    btcTxHash: x.btcTxHash,
                    createdAt: x.createdAt,
                    itemIds,
                };
            });
            return { list, total };
        }
    async getTokenStaticsList(tokenStatisticInput: TokensStatisticInput): Promise<TokensStatisticOutputDto> {
            let { xudtTypeHash, timeType, tokenId } = tokenStatisticInput;
            let tokenEntity = await this.tokenStaticService.getTokenEntityByIdOrTypeHash(tokenId, xudtTypeHash);
            if (!tokenEntity) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            let startTime = 0;
            switch (timeType) {
                case StaticsTimeType.Day:
                    startTime = moment().subtract(1, 'day').unix();
                    break;
                case StaticsTimeType.Week:
                    startTime = moment().subtract(1, 'week').unix();
                    break;
                default:
                    startTime = moment().subtract(1, 'month').unix();
                    break;
            }
            const endTime = moment(new Date()).unix();
            let list = await this.tokenStaticService.getTokenStatisticList({
                time: Between(startTime, endTime),
                tokenId: tokenEntity.id,
            });
            let tokenList = this.getDataWithInterval(list);
            return { tokenList, total: tokenList.length };
        }
    getDataWithInterval(list: TokenStatisticEntity[]): TokenStatisticInfo[] {
            let targetArray = [];
            const step = 30;
            if (list.length < step) {
                for (let index = 1; index < list.length; index += 1) {
                    let currencyInfo = list[index];
                    let lastInfo = list[index - 1];
                    targetArray.push({
                        time: currencyInfo.time,
                        volume: currencyInfo.volume.minus(lastInfo.volume),
                        price: currencyInfo.floorPrice,
                    });
                }
                return targetArray;
            }
            const interval = Math.ceil((list.length - 1) / step);
            for (let index = 1; index < list.length; index += interval) {
                if (targetArray.length >= step) {
                    break;
                }
                let currencyInfo = list[index];
                let lastInfo = list[index - 1];
                if (index > interval) {
                    currencyInfo = list[index];
                    lastInfo = list[index - interval];
                }
                targetArray.push({
                    time: currencyInfo.time,
                    volume: currencyInfo.volume.minus(lastInfo.volume),
                    price: currencyInfo.floorPrice,
                });
            }
            return targetArray;
        }
    syncAPICacheKey() {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Tokens:SyncCkbApi{tag}`;
        }
    syncAPITokenCacheKey() {
            return `${this.appConfig.nodeEnv}:Hue:Hub:Task:SyncAPITokenData:{tag}`;
        }
    @Cron('0 */1 * * * *')
    async syncAPITokenData(): Promise<void> {
            const cacheKey = this.syncAPITokenCacheKey();
            const lock = await this.redlockService.acquireLock([cacheKey], TIME.ONE_MINUTES * 1000);
            if (lock) {
                this.logger.log('[syncAPITokenData] task start');
                let tokenList = await this.getTokenList(1, []);
                let nonNullToken = tokenList
                    .map((tokenInfo) => {
                    let attributes = tokenInfo.attributes;
                    if (!attributes.symbol ||
                        !attributes.xudtTags.includes('rgbpp-compatible')) {
                        this.logger.warn(`[syncAPITokenData] api return symbol is null or duplicate ${JSON.stringify(attributes)}`);
                        return null;
                    }
                    return tokenInfo;
                })
                    .filter((token) => token !== null);
                this.logger.log(`[syncAPITokenData] tokenList length ${tokenList.length} and nonNullToken length ${nonNullToken.length}`);
                let typeHash = nonNullToken.map((token) => token.attributes.typeHash);
                let symbol = nonNullToken.map((token) => token.attributes.symbol.toLowerCase());
                let tokenEntities = await this.tokenStaticService.findTokenEntities({
                    xudtTypeHash: In(typeHash),
                    lowercaseSymbol: In(symbol),
                });
                nonNullToken.map(async (tokenInfo) => {
                    let attributes = tokenInfo.attributes;
                    let entity = tokenEntities.find((entity) => entity.xudtTypeHash === attributes.typeHash);
                    if (!entity) {
                        this.logger.log(`[syncAPITokenData] token not in db,the symbol is ${attributes.symbol}`);
                        try {
                            let tokenEntity = new TokenEntity();
                            tokenEntity.updatedAt = new Date();
                            tokenEntity.createdAt = new Date();
                            tokenEntity.symbol = attributes.symbol;
                            tokenEntity.name = attributes.fullName;
                            tokenEntity.lowercaseSymbol = attributes.symbol.toLowerCase();
                            tokenEntity.name = attributes.fullName;
                            tokenEntity.iconUrl = attributes.iconFile;
                            tokenEntity.xudtTypeHash = attributes.typeHash.trim();
                            tokenEntity.xudtCodeHash = attributes.typeScript.codeHash.trim();
                            tokenEntity.xudtArgs = attributes.typeScript.args.trim();
                            tokenEntity.status = TokenStatus.Listing;
                            tokenEntity.decimals = parseInt(attributes.decimal);
                            tokenEntity.totalSupply = new Decimal(attributes.totalAmount);
                            tokenEntity.lastSales = new Decimal(0);
                            tokenEntity.lastVolume = new Decimal(0);
                            tokenEntity.floorPrice = new Decimal(0);
                            tokenEntity.marketCap = new Decimal(0);
                            tokenEntity.lastHolders = new Decimal(attributes.addressesCount);
                            tokenEntity.deployedTime = parseInt(attributes.createdAt);
                            const _saved = await this.tokenStaticService.insertToken(tokenEntity);
                            if (_saved) tokenEntity = _saved;
                        }
                        catch (error) {
                            this.logger.error(`[syncAPITokenData] insertToken error ${(error as Error).message}, symbol is ${attributes.symbol},type hash ${attributes.typeHash}}`);
                        }
                    }
                });
                let key = this.syncAPICacheKey();
                await this.redis.set(key, 'true', 'EX', TIME.HALF_HOUR);
                await this.redlockService.releaseLock(lock);
            }
            else {
                this.logger.log('[syncAPITokenData] task is already running on another instance');
            }
        }
    async getTokenList(page: number, data: ExplorerData[]): Promise<ExplorerData[]> {
            let key = this.syncAPICacheKey();
            let cacheSyncStatus = await this.redis.get(key);
            let response = await this.ckbExplorerApiService.getXudtList('', page);
            if (!response) {
                this.logger.log(`[getTokenList] response null data length = ${data.length},${page}`);
                return data;
            }
            data = data.concat(response.data);
            this.logger.log(`[getTokenList] concat data length = ${data.length},${page},response:${response.meta.total}`);
            if (cacheSyncStatus) {
                return data;
            }
            if (data.length < response.meta.total) {
                page += 1;
                return this.getTokenList(page, data);
            }
            return data;
        }
}
