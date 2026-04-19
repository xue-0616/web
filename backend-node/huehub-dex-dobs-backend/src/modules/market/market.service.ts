import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { ItemListOutputDto, ShowItemLoadingStatus } from '../collection/dto/items.output.dto';
import { CollectionEntity, ItemEntity, ItemStatus, OrderStatus, OrderType } from '../../database/entities';
import { SortDirection } from '../collection/dto/collections.input.dto';
import { ItemsDbService } from './db.service.ts/item.db.service';
import { BtcService } from '../btc/btc.service';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import { IJwt } from '../../common/interface/jwt';
import { ListItemsInputDto } from '../collection/dto/list.items.input.dto';
import { ListItemsOutputDto } from '../collection/dto/list.items.output.dto';
import { PsbtService } from './psbt.service';
import { IndexerDbService } from '../indexer/indexer.db.service';
import { BuyItemsInputDto, ItemPSBTInputDto } from '../collection/dto/buy.tems.input.dto';
import { BuyItemsOutputDto, ItemPSBTOutputDto, ShowOrderStatus } from '../collection/dto/buy.items.output.dto';
import { OrdersDbService } from './db.service.ts';
import { TransactionService } from './tx.service';
import { UnlistItemsInputDto } from '../collection/dto/unlist.items.input.dto';
import { UnlistItemsOutputDto } from '../collection/dto/unlist.items.output.dto';
import { MyOrdersInput, ShowOrderType } from '../collection/dto/my.orders.input.dto';
import { MyOrdersOutput } from '../collection/dto/my.orders.output.dto';
import { ActivitiesInputDto, ActivityType } from '../collection/dto/activities.input.dto';
import { ActivitiesOutputDto } from '../collection/dto/activities.output.dto';
import Decimal from 'decimal.js';
import { convertTokenPriceToUSDPrice, itemStatusToShowItemStatus } from '../../common/utils/tools';
import { TIME } from '../../common/utils/const.config';
import { StatusName } from '../../common/utils/error.code';
import { In } from 'typeorm';

@Injectable()
export class MarketService {
    constructor(private readonly logger: AppLoggerService, private readonly itemsDbService: ItemsDbService, private readonly btcService: BtcService, private readonly appConfigService: AppConfigService, private readonly psbtService: PsbtService, private readonly indexerDbService: IndexerDbService, private readonly ordersDbService: OrdersDbService, private readonly transactionService: TransactionService, @InjectRedis() private readonly redis: Redis) {
        this.logger.setContext(MarketService.name);
    }
    itemsCacheKey(clusterTypeHash: string): string {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Dobs:Items:${clusterTypeHash}{tag}`;
        }
    async items(collectionEntity: CollectionEntity, sort: SortDirection, page: number, limit: number): Promise<ItemListOutputDto> {
            let key = this.itemsCacheKey(collectionEntity.clusterTypeHash);
            const cacheData = await this.redis.get(key);
            if (cacheData) {
                return JSON.parse(cacheData);
            }
            let [items, total] = await this.itemsDbService.getItemsPaginated(collectionEntity.id, sort, page, limit);
            let btcPrice = await this.btcService.getBtcPrice();
            let list = items.map((item) => {
                const itemInfo = {
                    id: item.id,
                    txHash: item.txHash,
                    btcValue: item.btcValue,
                    index: item.index,
                    sellerAddress: item.sellerAddress,
                    price: item.price,
                    usdPrice: convertTokenPriceToUSDPrice(new Decimal(btcPrice.USD), item.price).toFixed(4),
                    name: collectionEntity.name,
                    status: ShowItemLoadingStatus.Loading,
                    prevBg: item.dobs.sporeIconUrl,
                    prevBgColor: item.dobs.sporePrevBgcolor,
                    prevType: item.dobs.sporeContentType,
                    dobId: item.dobs.sporeTokenId,
                    sporeArgs: `0x${item.dobs.typeArgs}`,
                    sporeTypeHash: `0x${item.dobs.typeScriptHash}`,
                };
                return itemInfo;
            });
            let data = { list, total };
            await this.redis.set(key, JSON.stringify(data), 'EX', TIME.TEN_SECOND);
            return data;
        }
    async listItems(user: IJwt, input: ListItemsInputDto, collection: CollectionEntity): Promise<ListItemsOutputDto> {
            let { address } = user;
            let { items } = input;
            const itemsList = (await Promise.all(items.map((item) => this.initItemEntity(address, item, collection)))).filter(Boolean);
            if (itemsList.length != items.length) {
                this.logger.error('[listItems] item length not match');
                throw new BadRequestException(StatusName.ItemExisting);
            }
            const item = await this.itemsDbService.batchInsertItem(itemsList);
            let ids = item.map((x) => x.id);
            if (ids.length == 0) {
                this.logger.error('item insert error ');
                throw new BadRequestException(StatusName.ItemExisting);
            }
            return { itemIds: ids };
        }
    async initItemEntity(address: any, item: any, collection: any) {
            const data = await this.itemsDbService.queryItem({
                txHash: item.txHash,
                index: item.index,
            });
            if (data) {
                this.logger.log(`The utxo ${item.txHash}:${item.index} already exists`);
                throw new BadRequestException(StatusName.ItemExisting);
            }
            item.psbt = this.psbtService.verifyListPsbt(item.psbtSig, address, item.price, item.txHash, item.index);
            let spendingStatus = await this.btcService.getSpendingStatus(item.txHash.replace('0x', ''), item.index);
            if (spendingStatus && spendingStatus.spent) {
                this.logger.error('utxo is spent ');
                throw new BadRequestException(StatusName.UtxoNotLive);
            }
            const dobsCell = await this.indexerDbService.findOneDobsEntity({
                btcAddress: address,
                btcIndex: item.index,
                btcTxHash: item.txHash.replace('0x', ''),
                clusterTypeArgs: collection.clusterTypeArgs,
            });
            if (!dobsCell) {
                this.logger.error('not live rgbpp cell');
                throw new BadRequestException(StatusName.UtxoNotLive);
            }
            if (dobsCell.btcValue !== 546) {
                this.logger.error(`utxo value not eq 546,the btcValue is ${dobsCell.btcValue}`);
                throw new BadRequestException(StatusName.UtxoValueNotMatch);
            }
            return this.itemsDbService.initItemEntity(collection, dobsCell, address, item);
        }
    async getItemPSBT(input: ItemPSBTInputDto): Promise<ItemPSBTOutputDto> {
            const itemPsbts = await this.getPSBTs(input.itemIds);
            return {
                feeAddress: this.appConfigService.rgbPPConfig.receiveFeeAddress,
                psbts: itemPsbts,
                feeRate: this.appConfigService.rgbPPConfig.feeRate,
                minServiceFee: this.appConfigService.rgbPPConfig.minMarketFee.toString(),
            };
        }
    async getPSBTs(ids: any) {
            let items = await this.validateItemsForPurchase(ids);
            return items.map((item) => {
                return {
                    itemId: item.id,
                    psbt: item.unsignedPsbt,
                };
            });
        }
    async validateItemsForPurchase(ids: any) {
            const uniqueIds = Array.from(new Set(ids));
            const items = await this.itemsDbService.findItems({
                id: In(uniqueIds),
                status: ItemStatus.Init,
            }, { dobs: true });
            if (items.length !== uniqueIds.length) {
                const invalidId = uniqueIds.find((id) => {
                    const itemIndex = items.findIndex((v) => {
                        return v.id === id;
                    });
                    return itemIndex === -1;
                });
                this.logger.error(`[getPSBTs] cannot find item ${invalidId}`);
                throw new BadRequestException(StatusName.ItemInvalid);
            }
            let inactiveItems = [];
            try {
                inactiveItems = await this.psbtService.filterInactivePurchaseItems(items);
            }
            catch (error) {
                this.logger.error(`[validateItemsForPurchase] ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (inactiveItems.length > 0) {
                await this.itemsDbService.invalidItems(inactiveItems);
                this.logger.error(`not find utxos for items ${inactiveItems.map((v) => v.id)}`);
                throw new BadRequestException(StatusName.ItemInvalid);
            }
            return items;
        }
    async buyItem(user: IJwt, buyItemsInput: BuyItemsInputDto): Promise<{
        data: BuyItemsOutputDto;
        collectionId: number;
    }> {
            let { marketFee, rgbppCKBTransaction, signedBTCTransaction, itemIds, transactionFee, } = buyItemsInput;
            let items = await this.checkBuyerItems(buyItemsInput);
            const { psbt, ckbVirtualTxResult, btcTxId } = await this.psbtService.checkBuyRgbppBtcTransaction(signedBTCTransaction, items, marketFee, user.address, rgbppCKBTransaction);
            this.logger.log(`[buyItem] btcTxId = ${btcTxId}`);
            let orderEntity = await this.ordersDbService.initOrderByTransaction(itemIds, OrderType.Buy, signedBTCTransaction, JSON.stringify(rgbppCKBTransaction), user.address, transactionFee, btcTxId, marketFee);
            await this.sendRgbppTransaction(orderEntity, psbt, ckbVirtualTxResult);
            const data = {
                status: ShowOrderStatus.Pending,
                btcTransactionHash: btcTxId,
            };
            const collectionId = items[0].collectionId;
            return {
                data,
                collectionId,
            };
        }
    async checkBuyerItems(input: any) {
            const itemIds = Array.from(new Set(input.itemIds));
            const items = await this.validateItemsForPurchase(itemIds);
            const totalPrice = items.reduce((sum, currentItem) => sum.add(currentItem.price), new Decimal(0));
            let totalMarketFee = totalPrice
                .mul(new Decimal(this.appConfigService.rgbPPConfig.feeRate))
                .ceil()
                .toNumber();
            if (totalMarketFee >= this.appConfigService.rgbPPConfig.minMarketFee) {
                if (totalMarketFee != parseInt(input.marketFee)) {
                    this.logger.error(`marketFee not match ${input.marketFee} != ${totalMarketFee}`);
                    throw new BadRequestException(StatusName.ServiceFeeNotMatch);
                }
            }
            else {
            }
            return items;
        }
    async sendRgbppTransaction(orderEntity: any, psbt: any, ckbVirtualTxResult: any) {
            if (orderEntity) {
                const ret = await this.transactionService.sendRgbppTransaction(psbt, orderEntity, ckbVirtualTxResult);
                if (!!ret) {
                    orderEntity.status = OrderStatus.btcPending;
                    orderEntity.updatedAt = new Date();
                    await this.ordersDbService.updateOrderEntity(orderEntity);
                }
            }
            else {
                this.logger.error('[sendRgbppTransaction] db update error');
                throw new BadRequestException(StatusName.PsbtException);
            }
        }
    async unlistItems(user: IJwt, unlistItemInput: UnlistItemsInputDto): Promise<{
        data: UnlistItemsOutputDto;
        collectionId: number;
    }> {
            const { itemIds, transactionFee, signedBTCTransaction, rgbppCKBTransaction, } = unlistItemInput;
            let items = await this.checkUnlistItems(unlistItemInput, user.address);
            const { psbt, ckbVirtualTxResult, btcTxId } = await this.psbtService.checkUnlistRgbppBtcTransaction(signedBTCTransaction, items, rgbppCKBTransaction);
            this.logger.log(`[unlistItems] btcTxId = ${btcTxId}`);
            let orderEntity = await this.ordersDbService.initOrderByTransaction(itemIds, OrderType.Unlist, signedBTCTransaction, JSON.stringify(rgbppCKBTransaction), user.address, transactionFee, btcTxId);
            await this.sendRgbppTransaction(orderEntity, psbt, ckbVirtualTxResult);
            const data = {
                status: ShowOrderStatus.Pending,
                btcTransactionHash: btcTxId,
            };
            const collectionId = items[0].collectionId;
            return {
                data,
                collectionId,
            };
        }
    async checkUnlistItems(input: UnlistItemsInputDto, address: string): Promise<ItemEntity[]> {
            let items = await this.itemsDbService.findItems({
                id: In(input.itemIds),
                status: ItemStatus.Init,
                sellerAddress: address,
            }, { dobs: true });
            if (items.length !== input.itemIds.length) {
                this.logger.error('[checkUnlistItems] some items states are unavailable');
                throw new BadRequestException(StatusName.ItemInvalid);
            }
            return items;
        }
    async queryOrders(user: IJwt, myOrdersInput: MyOrdersInput, collection: CollectionEntity | undefined): Promise<MyOrdersOutput> {
            const [btcPrice, [items, total]] = await Promise.all([
                this.btcService.getBtcPrice(),
                this.itemsDbService.queyAddressOrders(user.address, myOrdersInput, collection),
            ]);
            const itemList = items.map((x) => this.getItemsInfo(x, btcPrice, user.address));
            return {
                list: itemList,
                total,
            };
        }
    getItemsInfo(item: any, btcPrice: any, address: any) {
            const usdPrice = convertTokenPriceToUSDPrice(new Decimal(btcPrice.USD), item.price).toFixed(4);
            let type;
            if (item.isCancel) {
                type = ShowOrderType.Unlist;
            }
            else if (item.buyerAddress == address) {
                type = ShowOrderType.Bought;
            }
            else if (item.sellerAddress == address && item.status > ItemStatus.Init) {
                type = ShowOrderType.SoldOut;
            }
            else {
                type = ShowOrderType.Listing;
            }
            return {
                type,
                id: item.id,
                txHash: item.txHash,
                index: item.index,
                btcValue: item.btcValue,
                sellerAddress: item.sellerAddress,
                name: item.collection.name,
                price: item.price,
                usdPrice,
                status: itemStatusToShowItemStatus(item.status),
                sporeTypeHash: `0x${item.dobs.typeScriptHash}`,
                sporeArgs: `0x${item.dobs.typeArgs}`,
                dobId: item.dobs.sporeTokenId,
                prevType: item.dobs.sporeContentType,
                prevBgColor: item.dobs.sporePrevBgcolor,
                prevBg: item.dobs.sporeIconUrl,
                createdTime: Math.floor(item.updatedAt.getTime() / 1000),
                from: item.sellerAddress,
                to: item.buyerAddress,
                btcTxHash: item.order ? item.order.btcTxHash : null,
                ckbTxHash: item.order
                    ? item.order.ckbTxHash
                        ? `0x${item.order.ckbTxHash}`
                        : null
                    : null,
            };
        }
    async getActivities(collection: CollectionEntity, activitiesInputDto: ActivitiesInputDto): Promise<ActivitiesOutputDto> {
            const [[items, total], btcPrice] = await Promise.all([
                this.itemsDbService.queyActivities(activitiesInputDto, collection),
                this.btcService.getBtcPrice(),
            ]);
            const itemList = (await Promise.all(items.map((x) => this.getActivityInfo(x, btcPrice)))).filter(Boolean);
            return { list: itemList, total };
        }
    getActivityInfo(item: any, btcPrice: any) {
            const usdPrice = convertTokenPriceToUSDPrice(new Decimal(btcPrice.USD), item.price).toFixed(4);
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
                name: item.collection.name,
                price: item.price,
                usdPrice,
                decimal: item.collection.decimals,
                status: itemStatusToShowItemStatus(item.status),
                createdTime: Math.floor(item.updatedAt.getTime() / 1000),
                to: item.buyerAddress,
                btcTxHash: item.order ? item.order.btcTxHash : null,
                ckbTxHash: item.order
                    ? item.order.ckbTxHash
                        ? `0x${item.order.ckbTxHash}`
                        : null
                    : null,
            };
        }
}
