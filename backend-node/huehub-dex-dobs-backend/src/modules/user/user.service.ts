import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { IJwt } from '../../common/interface/jwt';
import { JwtService } from '@nestjs/jwt';
import { AssetsInputDto } from './dto/assets.input.dto';
import { AssetInfo, AssetsOutputDto, ShowUtxoStatus, UTXOInfo } from './dto/assets.output.dto';
import { CollectionDbService } from '../collection/db.service';
import { BtcAssetsService } from '../btc/btc.assets.service';
import { BtcService } from '../btc/btc.service';
import { CollectionEntity, DobsEntity, DobsStatus, ItemEntity, ItemStatus } from '../../database/entities';
import { IndexerDbService } from '../indexer/indexer.db.service';
import { UsdPrice } from '../../common/interface/mempool.dto';
import { ItemsDbService } from '../market/db.service.ts/item.db.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import Decimal from 'decimal.js';
import { TIME } from '../../common/utils/const.config';
import { StatusName } from '../../common/utils/error.code';
import { convertTokenPriceToUSDPrice } from '../../common/utils/tools';

@Injectable()
export class UserService {
    constructor(private readonly logger: AppLoggerService, readonly jwtService: JwtService, private readonly btcService: BtcService, private readonly btcAssetsService: BtcAssetsService, private readonly indexerDbService: IndexerDbService, private readonly collectionDbService: CollectionDbService, private readonly itemsDbService: ItemsDbService, @InjectRedis() private readonly redis: Redis, private readonly appConfigService: AppConfigService) {
        this.logger.setContext(UserService.name);
    }
    verifyToken(token: string): IJwt | undefined {
            try {
                const data = this.jwtService.verify(token);
                return data;
            }
            catch (error) {
                return undefined;
            }
        }
    async getDobsAssets(user: IJwt, input: AssetsInputDto): Promise<AssetsOutputDto> {
            let { address } = user;
            let { clusterTypeHash, fullUTXO } = input;
            let { btcUsd, balance, availableBalance, frozenBalance } = await this.getBtcAsset(address);
            let collections: any[] = [];
            if (clusterTypeHash) {
                collections = await this.findOneDobsAsset(address, clusterTypeHash, btcUsd, fullUTXO);
            }
            else {
                collections = await this.findAllDobsAsset(address, btcUsd, fullUTXO);
            }
            let data = { collections, balance, availableBalance, frozenBalance };
            return data;
        }
    addressAssetCacheKey(address: any) {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Asset:Dobs:${address}{tag}`;
        }
    async getBtcAsset(address: string): Promise<any> {
            let key = this.addressAssetCacheKey(address);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let [btcUsd, btcBalance] = await Promise.all([
                this.btcService.getBtcPrice(),
                this.btcAssetsService.getBtcBalance(address),
            ]);
            let frozenBalance = `${btcBalance ? btcBalance.pending_satoshi : 0}`;
            let availableBalance = `${btcBalance ? btcBalance.satoshi : 0}`;
            let balance = `${parseInt(frozenBalance) + parseInt(availableBalance)}`;
            const data = { btcUsd, balance, availableBalance, frozenBalance };
            await this.redis.set(key, JSON.stringify(data), 'EX', TIME.TEN_SECOND);
            return data;
        }
    async findOneDobsAsset(address: string, clusterTypeHash: string, btcUsd: UsdPrice, fullUTXO: boolean): Promise<AssetInfo[]> {
            let collection = await this.collectionDbService.findOne({
                clusterTypeHash,
            });
            if (!collection) {
                this.logger.error(`[getDobsAssets] collection not find ${clusterTypeHash}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            const [addressDobs, items] = await Promise.all([
                this.indexerDbService.getAddressDobs({
                    btcAddress: address,
                    clusterTypeArgs: collection.clusterTypeArgs,
                }),
                this.itemsDbService.getListingAndPendingItemsByAddress(address),
            ]);
            let data = await this.getAdderssAsset(addressDobs, collection, btcUsd, items, fullUTXO);
            return [data];
        }
    async findAllDobsAsset(address: string, btcUsd: UsdPrice, fullUTXO: boolean): Promise<AssetInfo[]> {
            const [collections, addressDobs, items] = await Promise.all([
                this.collectionDbService.find({
                    status: DobsStatus.Listing,
                }),
                this.indexerDbService.getAddressDobs({
                    btcAddress: address,
                }),
                this.itemsDbService.getListingAndPendingItemsByAddress(address),
            ]);
            this.logger.log(`[findAllDobsAsset] collections length = ${collections.length}`);
            if (collections.length == 0) {
                return [];
            }
            let list = await Promise.all(collections.map((collection) => this.getAdderssAsset(addressDobs, collection, btcUsd, items, fullUTXO)));
            return list;
        }
    async getAdderssAsset(addressDobs: Record<string, DobsEntity[]>, collection: CollectionEntity, btcUsd: UsdPrice, items: ItemEntity[], fullUTXO: boolean): Promise<AssetInfo> {
            let utxoCount = 0;
            let amount = 0;
            let utxos: any[] = [];
            if (!fullUTXO) {
                let count = addressDobs[collection.clusterTypeArgs]
                    ? addressDobs[collection.clusterTypeArgs].length
                    : 0;
                utxoCount = count;
                amount = count;
            }
            else {
                let count = addressDobs[collection.clusterTypeArgs]
                    ? addressDobs[collection.clusterTypeArgs].length
                    : 0;
                let list = addressDobs[collection.clusterTypeArgs]
                    ? addressDobs[collection.clusterTypeArgs]
                    : [];
                utxoCount = count;
                amount = count;
                utxos = await this.getUtxoInfo(items, list, collection.name);
            }
            let collectionInfo = {
                id: collection.id,
                iconUrl: collection.iconUrl,
                name: collection.name,
                description: collection.description,
                price: collection.floorPrice.toFixed(8),
                decimal: collection.decimals,
                clusterArgs: `0x${collection.clusterTypeArgs}`,
                clusterTypeHash: `0x${collection.clusterTypeHash}`,
                usdPrice: convertTokenPriceToUSDPrice(new Decimal(btcUsd.USD), collection.floorPrice).toFixed(4),
                utxoCount,
                amount,
            };
            return {
                collectionInfo,
                utxos,
            };
        }
    async getUtxoInfo(items: ItemEntity[], list: DobsEntity[], name: string): Promise<UTXOInfo[]> {
            let utxos = list.map((dobsCell) => {
                let utxoInfo: any = {
                    txHash: dobsCell.btcTxHash,
                    index: dobsCell.btcIndex,
                    value: `${dobsCell.btcValue}`,
                    sporeTypeHash: `0x${dobsCell.typeScriptHash}`,
                    sporeArgs: `0x${dobsCell.typeArgs}`,
                    prevBg: dobsCell.sporeIconUrl,
                    prevBgColor: dobsCell.sporePrevBgcolor,
                    dobId: dobsCell.sporeTokenId,
                    prevType: dobsCell.sporeContentType,
                    name,
                    status: ShowUtxoStatus.LiveUtxo,
                };
                const item = items.find((x) => x.txHash === dobsCell.btcTxHash && x.index === dobsCell.btcIndex);
                if (item) {
                    (utxoInfo.status =
                        item.status == ItemStatus.Init
                            ? ShowUtxoStatus.ListUtxo
                            : ShowUtxoStatus.ListPendingUtox),
                        (utxoInfo.itemId = item.id);
                }
                return utxoInfo;
            });
            return utxos;
        }
}
