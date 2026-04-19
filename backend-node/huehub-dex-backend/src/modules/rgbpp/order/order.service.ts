import { BadRequestException, Injectable } from '@nestjs/common';
import { ListItemsInputDto } from '../dto/list-items.input.dto';
import { BuyItemsInputDto, ItemPSBTInputDto } from '../dto/buy-items.input.dto';
import { UnlistItemsInputDto } from '../dto/unlist-items.input.dto';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { ItemsInputDto } from '../dto/items.input.dto';
import { ItemService } from './item.service';
import { ItemListOutputDto, ShowItemLoadingStatus } from '../dto/items.output.dto';
import Decimal from 'decimal.js';
import { BtcService } from '../../../modules/btc/btc.service';
import { ListItemsOutputDto } from '../dto/list-items.output.dto';
import { TokenStatisticService } from '../tokens/token.statistic.service';
import { ItemEntity, ItemStatus } from '../../../database/entities/item.entity';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import { BuyItemsOutputDto, ItemPSBT, ItemPSBTOutputDto, OrderStatus as BuyOrderStatus } from '../dto/buy-items.output.dto';
import { IJwt } from '../../../common/interface/jwt';
import { MyOrdersOutput, OrderInfo } from '../dto/my-orders.output.dto';
import { MyOrdersInput, OrderType as MyOrderType } from '../dto/my-orders.input.dto';
import { UsdPrice } from '../../../common/interface/mempool.dto';
import { OrderEntity, OrderStatus, OrderType } from '../../../database/entities/order.entity';
import { RgbppAssetsService } from '../rgbpp.service';
import { UnlistItemsOutputDto } from '../dto/unlist-items.output.dto';
import { RgbPPIndexerService } from '../indexer.service';
import { TokenEntity } from '../../../database/entities/token.entity';
import { BtcAssetsService } from '../../../modules/btc/btc.assets.service';
import { BtcTransferVirtualTxResult } from '@rgbpp-sdk/ckb';
import { convertTokenPriceToUSDPrice, itemStatusToShowItemStatus, psbtValidator } from '../../../common/utils/tools';
import { StatusName } from '../../../common/utils/error.code';
import { Psbt, Transaction, networks } from 'bitcoinjs-lib';
import { In } from 'typeorm';

@Injectable()
export class OrderService {
    constructor(private readonly appConfig: AppConfigService, private readonly logger: AppLoggerService, private readonly btcService: BtcService, private readonly itemService: ItemService, private readonly tokenStatisticService: TokenStatisticService, private readonly rgbPpAssetsService: RgbppAssetsService, private readonly rgbppIndexerService: RgbPPIndexerService, private readonly btcAssetsService: BtcAssetsService) {
        this.logger.setContext(OrderService.name);
    }
    async getItemsByToken(query: ItemsInputDto): Promise<ItemListOutputDto> {
            const btcPrice = await this.btcService.getBtcPrice();
            const { tokenId, xudtTypeHash, page, sort, limit } = query;
            let tokenEntity = await this.tokenStatisticService.getTokenEntityByIdOrTypeHash(tokenId, xudtTypeHash);
            if (!tokenEntity) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            const [items, total] = await this.itemService.getTokenItemsPaginated(tokenEntity.id, sort, limit, page);
            const list = [];
            for (const item of items) {
                const itemInfo = {
                    id: item.id,
                    txHash: item.txHash,
                    sellerAddress: item.sellerAddress,
                    btcValue: item.btcValue,
                    index: item.index,
                    name: item.token.name,
                    symbol: item.token.symbol,
                    xudtArgs: item.token.xudtArgs,
                    xudtCodeHash: item.token.xudtCodeHash,
                    totalPrice: item.price.toString(),
                    totalUsdPrice: convertTokenPriceToUSDPrice(item.price, new Decimal(btcPrice.USD)).toFixed(4),
                    pricePerToken: item.pricePerToken.toFixed(8),
                    usdPricePerToken: convertTokenPriceToUSDPrice(item.pricePerToken, new Decimal(btcPrice.USD)).toFixed(4),
                    tokenAmount: item.tokenAmount.toString(),
                    status: ShowItemLoadingStatus.Loading,
                    tokenDecimal: item.token.decimals,
                };
                list.push(itemInfo);
            }
            return { list, total };
        }
    async listItems(listItemsInput: ListItemsInputDto): Promise<ListItemsOutputDto> {
            const { items, address } = listItemsInput;
            const tokenInfo = await this.tokenStatisticService.getTokenInfo({
                id: items[0].tokenId,
            });
            if (!tokenInfo) {
                this.logger.error('tokenInfo not find');
                throw new BadRequestException(StatusName.ParameterException);
            }
            const itemsList = (await Promise.all(items.map((x) => this.checkListItem(address, x, tokenInfo)))).filter(Boolean);
            if (itemsList.length != items.length) {
                this.logger.error('item length not match');
                throw new BadRequestException(StatusName.ItemExisting);
            }
            const item = await this.itemService.batchInsertItem(itemsList);
            let ids = item.map((x) => x.id);
            if (ids.length == 0) {
                this.logger.error('item insert error ');
                throw new BadRequestException(StatusName.ItemExisting);
            }
            await this.itemService.removeUserRgbppCacheData(address);
            this.tokenStatisticService.updateTokenFloorPrice(tokenInfo);
            return { itemIds: ids };
        }
    async checkListItem(address: any, listItemInput: any, tokenInfo: any) {
            listItemInput.psbt = this.checkPsbt(listItemInput.psbtSig, address, new Decimal(listItemInput.price), listItemInput.txHash, listItemInput.index);
            let spendingStatus = await this.btcService.getSpendingStatus(listItemInput.txHash.replace('0x', ''), listItemInput.index);
            if (spendingStatus && spendingStatus.spent) {
                this.logger.error('utxo is spent ');
                throw new BadRequestException(StatusName.UtxoNotLive);
            }
            const items = await this.rgbppIndexerService.getAccountTokenOutpoint(address, tokenInfo.xudtTypeHash, {
                txHash: listItemInput.txHash,
                index: listItemInput.index,
            });
            if (!items ||
                items.list.length < 1 ||
                items.list[0].amount !== listItemInput.amount) {
                this.logger.error('not live rgbpp cell');
                throw new BadRequestException(StatusName.UtxoNotLive);
            }
            if (items.list[0].btcValue !== '546') {
                this.logger.error(`utxo value not eq 546,the btcValue is ${items.list[0].btcValue}`);
                throw new BadRequestException(StatusName.UtxoValueNotMatch);
            }
            const data = await this.itemService.queryItem({
                txHash: listItemInput.txHash,
                index: listItemInput.index,
            });
            if (data) {
                this.logger.log(`The utxo ${listItemInput.txHash}:${listItemInput.index} already exists`);
                throw new BadRequestException(StatusName.ItemExisting);
            }
            return this.itemService.initItemEntity(tokenInfo, address, listItemInput, items.list[0].btcValue);
        }
    checkPsbt(sigPsbt: string, address: string, price: Decimal, txHash: string, index: number): string {
            const network = this.appConfig.isTestnet
                ? networks.testnet
                : networks.bitcoin;
            const psbt = Psbt.fromHex(sigPsbt, { network });
            if (psbt.txInputs.length !== 1 ||
                psbt.data.inputs[0].sighashType !==
                    (Transaction.SIGHASH_SINGLE |
                        Transaction.SIGHASH_ANYONECANPAY) ||
                psbt.txInputs[0].hash.reverse().toString('hex') !==
                    txHash.replace('0x', '') ||
                psbt.txInputs[0].index != index) {
                this.logger.error('psbt input not match');
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (psbt.txOutputs[0].address !== address ||
                psbt.txOutputs[0].value !== price.toNumber()) {
                this.logger.error('psbt output not match');
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (!psbt.validateSignaturesOfAllInputs(psbtValidator)) {
                this.logger.error('psbt signature validate failed');
                throw new BadRequestException(StatusName.ParameterException);
            }
            const unsignedPsbt = new Psbt({ network });
            unsignedPsbt.addInputs(psbt.txInputs);
            unsignedPsbt.addOutputs(psbt.txOutputs);
            psbt.data.inputs.forEach((input, index) => {
                if (input.witnessUtxo !== undefined) {
                    unsignedPsbt.updateInput(index, {
                        witnessUtxo: input.witnessUtxo,
                    });
                }
            });
            return unsignedPsbt.toHex();
        }
    async getItemPSBT(input: ItemPSBTInputDto): Promise<ItemPSBTOutputDto> {
            const itemPsbts = await this.getPSBTs(input.itemIds);
            return {
                feeAddress: this.appConfig.rgbPPConfig.receiveFeeAddress,
                psbts: itemPsbts,
                feeRate: this.appConfig.rgbPPConfig.feeRate,
                minServiceFee: this.appConfig.rgbPPConfig.minMarketFee.toString(),
            };
        }
    async getPSBTs(ids: number[]): Promise<ItemPSBT[]> {
            const uniqueIds = Array.from(new Set(ids));
            const items = await this.itemService.findItems({
                id: In(uniqueIds),
                status: ItemStatus.Init,
            });
            if (items.length !== uniqueIds.length) {
                const invalidId = uniqueIds.find((id) => {
                    const itemIndex = items.findIndex((v) => {
                        return v.id === id;
                    });
                    return itemIndex === -1;
                });
                this.logger.error(`cannot find item ${invalidId}`);
                throw new BadRequestException(StatusName.ItemInvalid);
            }
            try {
                await this.validateItemsForPurchase(items);
            }
            catch (error) {
                const e = error as Error;
                if (e.message === StatusName.ItemInvalid) {
                    throw new BadRequestException(e.message);
                }
                this.logger.error(`[validateItemsForPurchase] ${e?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            return items.map((item) => {
                return {
                    itemId: item.id,
                    psbt: item.unsignedPsbt,
                };
            });
        }
    async validateItemsForPurchase(items: ItemEntity[]): Promise<void> {
            const sellerAddresses = Array.from(new Set(items.map((item) => item.sellerAddress)));
            const utxos = await Promise.all(sellerAddresses.map(async (address) => {
                return {
                    utxos: await this.btcAssetsService.service.getBtcUtxos(address),
                    address,
                };
            }));
            let inactiveItems: ItemEntity[] = [];
            items.forEach((item) => {
                const addressUtxos = utxos.find((utxo) => utxo.address === item.sellerAddress);
                if (addressUtxos) {
                    const psbt = Psbt.fromHex(item.unsignedPsbt);
                    const inactiveTxInput = psbt.txInputs.find((txInput) => {
                        const txInputHash = Buffer.from(txInput.hash).reverse();
                        const utxo = addressUtxos.utxos.find((utxo) => {
                            return (utxo.txid === txInputHash.toString('hex') &&
                                utxo.vout === txInput.index);
                        });
                        return utxo === undefined || !utxo.status.confirmed;
                    });
                    if (inactiveTxInput) {
                        inactiveItems.push(item);
                    }
                }
                else {
                    inactiveItems = items.filter((innerItem) => innerItem.sellerAddress === item.sellerAddress);
                }
                if (item.btcValue.toNumber() !== 546) {
                    inactiveItems.push(item);
                }
            });
            if (inactiveItems.length > 0) {
                await this.itemService.invalidItems(inactiveItems);
                this.logger.error(`not find utxos for items ${inactiveItems.map((v) => v.id)}`);
                throw new BadRequestException(StatusName.ItemInvalid);
            }
        }
    async buyItem(user: IJwt, buyItemsInput: BuyItemsInputDto): Promise<BuyItemsOutputDto> {
            let buyerAddress = user.address;
            let { marketFee, rgbppCKBTransaction, signedBTCTransaction, transactionFee, itemIds, } = buyItemsInput;
            let [items, tokenInfo, totalSum] = await this.checkBuyerItems(buyItemsInput);
            let { buyerPsbt, ckbVirtualTxResult } = await this.rgbPpAssetsService.checkBuyRgbppBtcTransaction(signedBTCTransaction, items, totalSum, tokenInfo, rgbppCKBTransaction, marketFee, buyerAddress);
            let btcTxhash = buyerPsbt
                .extractTransaction()
                .getHash()
                .reverse()
                .toString('hex');
            this.logger.log(`[btcTxhash] buyItem = ${btcTxhash}`);
            let orderEntity = await this.itemService.initOrderByTransaction(itemIds, OrderType.Buy, signedBTCTransaction, JSON.stringify(rgbppCKBTransaction), buyerAddress, transactionFee, btcTxhash, marketFee);
            if (!orderEntity) {
                throw new BadRequestException(StatusName.PsbtException);
            }
            await this.sendRgbppTransaction(orderEntity, buyerPsbt, ckbVirtualTxResult);
            await this.itemService.removeUserRgbppCacheData(user.address);
            this.tokenStatisticService.updateTokenFloorPrice(tokenInfo);
            return {
                status: BuyOrderStatus.Pending,
                btcTransactionHash: btcTxhash,
            };
        }
    async sendRgbppTransaction(orderEntity: OrderEntity, psbt: Psbt, ckbVirtualTxResult: BtcTransferVirtualTxResult): Promise<void> {
            if (orderEntity) {
                const ret = await this.rgbPpAssetsService.sendRgbppTransaction(psbt, orderEntity, ckbVirtualTxResult);
                if (!!ret) {
                    orderEntity.status = (OrderStatus as any).btcPending ?? (OrderStatus as any).Pending;
                    orderEntity.updatedAt = new Date();
                    await this.itemService.updateOrderEntity(orderEntity);
                }
            }
            else {
                this.logger.error('[sendRgbppTransaction] db update error');
                throw new BadRequestException(StatusName.PsbtException);
            }
        }
    async checkBuyerItems(input: BuyItemsInputDto): Promise<[ItemEntity[], TokenEntity, Decimal]> {
            const itemIds = Array.from(new Set(input.itemIds));
            let items = await this.itemService.findItems({
                id: In(itemIds),
                status: ItemStatus.Init,
            });
            if (items.length !== itemIds.length) {
                this.logger.error('some items states are unavailable');
                throw new BadRequestException(StatusName.ItemInvalid);
            }
            await this.validateItemsForPurchase(items);
            const totalPrice = items.reduce((sum, currentItem) => sum.add(currentItem.price), new Decimal(0));
            const totalSum = items.reduce((sum, currentItem) => sum.add(currentItem.tokenAmount), new Decimal(0));
            let totalMarketFee = totalPrice
                .mul(new Decimal(this.appConfig.rgbPPConfig.feeRate))
                .ceil()
                .toNumber();
            // Enforce minimum market fee: if computed fee is below minimum,
            // use the minimum instead. Previously the else branch was empty,
            // which allowed buyers to pass any fee (including 0) when total was small.
            if (totalMarketFee < this.appConfig.rgbPPConfig.minMarketFee) {
                totalMarketFee = this.appConfig.rgbPPConfig.minMarketFee;
            }
            if (totalMarketFee !== parseInt(input.marketFee)) {
                this.logger.error(`marketFee not match ${input.marketFee} != ${totalMarketFee},totalSum is ${totalSum}`);
                throw new BadRequestException(StatusName.ServiceFeeNotMatch);
            }
            let tokenInfo = await this.tokenStatisticService.getTokenInfo({
                id: items[0].tokenId,
            });
            if (!tokenInfo) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            return [items, tokenInfo, totalSum];
        }
    async unlistItem(user: IJwt, unlistItemsInput: UnlistItemsInputDto): Promise<UnlistItemsOutputDto> {
            let { rgbppCKBTransaction, signedBTCTransaction, transactionFee, itemIds } = unlistItemsInput;
            let [items, tokenInfo, totalSum] = await this.checkUnlistItems(unlistItemsInput, user.address);
            const { buyerPsbt, ckbVirtualTxResult } = await this.rgbPpAssetsService.checkUnlistRgbppBtcTransaction(signedBTCTransaction, items, totalSum, tokenInfo, rgbppCKBTransaction);
            let btcTxhash = buyerPsbt
                .extractTransaction()
                .getHash()
                .reverse()
                .toString('hex');
            this.logger.log(`[btcTxhash] = ${btcTxhash}`);
            let orderEntity = await this.itemService.initOrderByTransaction(itemIds, OrderType.Unlist, signedBTCTransaction, JSON.stringify(rgbppCKBTransaction), user.address, transactionFee, btcTxhash);
            if (!orderEntity) {
                throw new BadRequestException(StatusName.PsbtException);
            }
            await this.sendRgbppTransaction(orderEntity, buyerPsbt, ckbVirtualTxResult);
            await this.itemService.removeUserRgbppCacheData(user.address);
            this.tokenStatisticService.updateTokenFloorPrice(tokenInfo);
            return {
                status: BuyOrderStatus.Pending,
                btcTransactionHash: btcTxhash,
            };
        }
    async checkUnlistItems(input: UnlistItemsInputDto, address: string): Promise<[ItemEntity[], TokenEntity, Decimal]> {
            const itemIds = Array.from(new Set(input.itemIds));
            let items = await this.itemService.findItems({
                id: In(itemIds),
                status: ItemStatus.Init,
                sellerAddress: address,
            });
            if (items.length !== itemIds.length) {
                this.logger.error('some items states are unavailable');
                throw new BadRequestException(StatusName.ItemInvalid);
            }
            const totalSum = items.reduce((sum, currentItem) => sum.add(currentItem.tokenAmount), new Decimal(0));
            let tokenInfo = await this.tokenStatisticService.getTokenInfo({
                id: items[0].tokenId,
            });
            if (!tokenInfo) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            return [items, tokenInfo, totalSum];
        }
    async queryOrders(user: IJwt, myOrdersInput: MyOrdersInput): Promise<MyOrdersOutput> {
            if (user.address != myOrdersInput.address) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            let tokenEntity = await this.tokenStatisticService.getTokenEntityByIdOrTypeHash(myOrdersInput.tokenId, myOrdersInput.xudtTypeHash);
            if (!tokenEntity) {
                throw new BadRequestException(StatusName.ParameterException);
            }
            myOrdersInput.tokenId = tokenEntity.id;
            const btcPrice = await this.btcService.getBtcPrice();
            const [items, total] = await this.itemService.queyAddressOrders(myOrdersInput);
            const itemList = items.map((x) => this.getItemsInfo(x, btcPrice, myOrdersInput.address));
            return {
                list: itemList,
                total,
            };
        }
    async fixOrderStatus(itemId: number): Promise<{
        status: import("../rgbpp.service").RGBPPTransactionStatus;
        ckbTxHash: string;
    } | null> {
            const item = await this.itemService.queryItemWithOrder({ id: itemId });
            if (!item || !item.order) {
                return null;
            }
            const orderId = item.order.id;
            try {
                let { status, ckbTxHash } = await this.rgbPpAssetsService.checkAndUpdateRgbppTransactionStatus({
                    orderId,
                    btcTxHash: item.order.btcTxHash,
                    queryTime: 0,
                });
                return { status, ckbTxHash };
            }
            catch (error) {
                return null;
            }
        }
    getItemsInfo(item: ItemEntity, btcPrice: UsdPrice, address: String): OrderInfo {
            const usdPricePerToken = convertTokenPriceToUSDPrice(item.pricePerToken, new Decimal(btcPrice.USD)).toFixed(4);
            const totalUsdPrice = convertTokenPriceToUSDPrice(item.price, new Decimal(btcPrice.USD)).toFixed(4);
            let type: MyOrderType;
            if (item.isCancel) {
                type = MyOrderType.Unlist;
            }
            else if (item.buyerAddress == address) {
                type = MyOrderType.Bought;
            }
            else if (item.sellerAddress == address && item.status > ItemStatus.Init) {
                type = MyOrderType.SoldOut;
            }
            else {
                type = MyOrderType.Listing;
            }
            return {
                type,
                id: item.id,
                txHash: item.txHash,
                index: item.index,
                btcValue: item.btcValue,
                sellerAddress: item.sellerAddress,
                name: item.token.name,
                symbol: item.token.symbol,
                xudtCodeHash: item.token.xudtCodeHash,
                xudtArgs: item.token.xudtArgs,
                totalPrice: item.price.toString(),
                totalUsdPrice,
                pricePerToken: item.pricePerToken.toString(),
                usdPricePerToken,
                tokenAmount: item.tokenAmount.toString(),
                status: itemStatusToShowItemStatus(item.status),
                tokenDecimal: item.token.decimals,
                createdTime: Math.floor(item.updatedAt.getTime() / 1000),
                from: item.sellerAddress,
                to: item.buyerAddress,
                btcTxHash: item.order ? item.order.btcTxHash : null,
                ckbTxHash: item.order ? item.order.ckbTxHash : null,
            };
        }
}
