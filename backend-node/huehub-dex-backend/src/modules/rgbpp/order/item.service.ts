import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ItemEntity, ItemStatus } from '../../../database/entities/item.entity';
import { OrderEntity, OrderStatus, OrderType } from '../../../database/entities/order.entity';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { SortDirection } from '../dto/tokens.input.dto';
import { ListItemInput } from '../dto/list-items.input.dto';
import { TokenEntity } from '../../../database/entities/token.entity';
import { MyOrdersInput, OrderType as MyOrderType } from '../dto/my-orders.input.dto';
import { ActivitiesInputDto, ActivityType } from '../dto/activities.input.dto';
import { OrderPendingInputDto } from '../dto/order.pending.input.dto';
import { ItemFloorPrice, ItemStatistic } from '../../../common/interface/statistic';
import Redis from 'ioredis';
import { AppConfigService } from '../../../common/utils-service/app.config.services';
import Decimal from 'decimal.js';
import { StatusName } from '../../../common/utils/error.code';
import { getFloorPriceForItem } from '../../../common/utils/tools';
import moment from 'moment';

@Injectable()
export class ItemService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(ItemEntity) private itemRepository: Repository<ItemEntity>, @InjectRepository(OrderEntity) private orderRepository: Repository<OrderEntity>, readonly dataSource: DataSource, @InjectRedis() private readonly redis: Redis, private readonly appConfig: AppConfigService) {
        this.logger.setContext(ItemService.name);
    }
    async initOrderByTransaction(itemIds: number[], type: OrderType, signedBTCTransaction: string, rgbppCKBTransaction: string, buyerAddress: string, transactionFee: string, btcTxhash: string, marketFee?: string): Promise<OrderEntity | null> {
            let orderEntity: any;
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let items = await manager.find(ItemEntity, {
                    where: {
                        id: In(itemIds),
                        status: ItemStatus.Init,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                if (itemIds.length != items.length) {
                    this.logger.error('[initOrderByTransaction] some items states are unavailable');
                    throw new BadRequestException(StatusName.ParameterException);
                }
                orderEntity = this.initOrderEntity(buyerAddress, signedBTCTransaction, rgbppCKBTransaction, type, marketFee ?? '0', transactionFee, btcTxhash);
                orderEntity = await manager.save(orderEntity);
                items = items.map((item) => {
                    item.status = ItemStatus.Pending;
                    item.isCancel = orderEntity.type == OrderType.Buy ? false : true;
                    item.orderId = orderEntity.id;
                    item.buyerAddress = buyerAddress;
                    return item;
                });
                await manager.save(items);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[initOrderByTransaction] ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
                throw error;
            }
            finally {
                await queryRunner.release();
            }
            return orderEntity;
        }
    async updateOrderAndItemsStatus(orderEntity: OrderEntity, itemStatus: ItemStatus, invalidIds: any[] = []): Promise<void> {
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                orderEntity.updatedAt = new Date();
                let items = await manager.find(ItemEntity, {
                    where: {
                        orderId: orderEntity.id,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                await manager.save(orderEntity);
                items = items.map((item) => {
                    if (itemStatus === ItemStatus.Init) {
                        item.buyerAddress = null;
                        item.orderId = null;
                        item.isCancel = null;
                    }
                    if (invalidIds.includes(item.id)) {
                        item.status = ItemStatus.Invalid;
                    }
                    else {
                        item.status = itemStatus;
                    }
                    item.updatedAt = new Date();
                    return item;
                });
                await manager.save(items);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[updateOrderAndItemsStatus] ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
    async updateOrderEntity(orderEntity: OrderEntity): Promise<OrderEntity | null> {
            return await this.orderRepository.save(orderEntity);
        }
    async queryOrderEntity(orderId: number): Promise<ItemEntity | null> {
            let item = await this.itemRepository.findOne({
                where: {
                    orderId,
                },
                relations: { token: true, order: true },
            });
            return item;
        }
    async findOrderEntity(orderId: number): Promise<OrderEntity | null> {
            let order = await this.orderRepository.findOne({
                where: {
                    id: orderId,
                },
                relations: { items: true },
            });
            return order;
        }
    initOrderEntity(buyerAddress: string, btcTx: string, ckbTx: string, type: OrderType, orderFee: string, btcTxFee: string, btcTxHash: string): OrderEntity {
            let orderEntity = new OrderEntity();
            orderEntity.buyerAddress = buyerAddress;
            orderEntity.btcTx = btcTx;
            orderEntity.ckbTx = ckbTx;
            orderEntity.btcTxHash = btcTxHash;
            orderEntity.btcTxFee = btcTxFee ? new Decimal(btcTxFee) : new Decimal(0);
            orderEntity.orderFee = orderFee ? new Decimal(orderFee) : new Decimal(0);
            orderEntity.type = type;
            orderEntity.status = OrderStatus.init;
            orderEntity.createdAt = new Date();
            orderEntity.updatedAt = new Date();
            return orderEntity;
        }
    async queryItem(where: FindOptionsWhere<ItemEntity>): Promise<ItemEntity | null> {
            return await this.itemRepository.findOne({ where });
        }
    async queryItemWithOrder(where: FindOptionsWhere<ItemEntity>): Promise<ItemEntity | null> {
            return await this.itemRepository.findOne({
                where,
                relations: { order: true },
            });
        }
    async findItems(where: FindOptionsWhere<ItemEntity> | FindOptionsWhere<ItemEntity>[]): Promise<ItemEntity[]> {
            return await this.itemRepository.find({ where, order: { id: 'desc' } });
        }
    async getListingAndPendingItemsByAddress(address: string): Promise<ItemEntity[]> {
            let data = await this.itemRepository
                .createQueryBuilder('item')
                .where('item.status in (:statusArray) and (buyer_address = :buyerAddress or seller_address = :sellerAddress) ', {
                statusArray: [ItemStatus.Init, ItemStatus.Pending],
                buyerAddress: address,
                sellerAddress: address,
            })
                .getMany();
            return data;
        }
    async getMinimalFloorPriceItem(tokenId: number): Promise<ItemEntity | null> {
            let data = await this.itemRepository.findOne({
                where: { tokenId, status: ItemStatus.Init },
                order: { pricePerToken: 'ASC' },
            });
            return data;
        }
    async getTotalSaleCountAndVolume(tokenId: number): Promise<{
        totalVolume: string;
        salesCount: number;
    }> {
            let data = await this.itemRepository
                .createQueryBuilder('item')
                .select('SUM(item.price)', 'totalVolume')
                .addSelect('count(item.id)', 'salesCount')
                .where('item.status = :status  AND item.isCancel is not :isCancel and item.tokenId =:tokenId', {
                status: ItemStatus.Complete,
                isCancel: true,
                tokenId,
            })
                .getRawOne();
            this.logger.log(`[getTotalSaleCountAndVolume] data = ${JSON.stringify(data)}`);
            return data;
        }
    async getAllMinimalFloorPriceItem(tokenIds: number[]): Promise<ItemFloorPrice[]> {
            if (tokenIds.length == 0) {
                return [];
            }
            let builder = this.itemRepository
                .createQueryBuilder('item')
                .select('item.tokenId', 'tokenId')
                .addSelect('MIN(item.pricePerToken)', 'pricePerToken')
                .where('item.status = :status and item.tokenId IN (:...tokenIds)', {
                status: ItemStatus.Init,
                tokenIds,
            })
                .groupBy('item.tokenId');
            let data = await builder.getRawMany();
            return data;
        }
    async getAllTotalSaleCountAndVolume(tokenIds: number[]): Promise<ItemStatistic[]> {
            if (tokenIds.length == 0) {
                return [];
            }
            let data = await this.itemRepository
                .createQueryBuilder('item')
                .select('item.tokenId', 'tokenId')
                .addSelect('SUM(item.price)', 'totalVolume')
                .addSelect('count(item.id)', 'salesCount')
                .where('item.status = :status  AND item.isCancel is not :isCancel and item.tokenId in (:tokenIds)', {
                status: ItemStatus.Complete,
                isCancel: true,
                tokenIds,
            })
                .groupBy('item.tokenId')
                .getRawMany();
            let list = data.map((x) => {
                return {
                    tokenId: x.tokenId,
                    totalVolume: x.totalVolume,
                    salesCount: x.salesCount,
                };
            });
            return list;
        }
    async insertItem(entity: ItemEntity): Promise<ItemEntity | null> {
            return await this.itemRepository.save(entity);
        }
    async batchInsertItem(entity: ItemEntity[]): Promise<ItemEntity[]> {
            return await this.itemRepository.save(entity);
        }
    initItemEntity(tokenInfo: TokenEntity, address: string, listItemInput: ListItemInput, btcValue: string): ItemEntity {
            let price = new Decimal(listItemInput.price);
            let tokenAmount = new Decimal(listItemInput.amount);
            let pricePerToken = getFloorPriceForItem(price, tokenAmount, tokenInfo.decimals);
            let entity = new ItemEntity();
            entity.tokenId = tokenInfo.id;
            entity.sellerAddress = address;
            entity.price = price;
            entity.tokenAmount = tokenAmount;
            entity.pricePerToken = pricePerToken;
            entity.txHash = listItemInput.txHash;
            entity.index = listItemInput.index;
            entity.unsignedPsbt = listItemInput.psbt;
            entity.psbtSig = listItemInput.psbtSig;
            entity.btcValue = new Decimal(btcValue);
            entity.status = ItemStatus.Init;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            return entity;
        }
    async getTokenItemsPaginated(tokenId: number, sort: SortDirection, limit: number, page: number): Promise<[ItemEntity[], number]> {
            return await Promise.all([
                this.itemRepository
                    .createQueryBuilder('item')
                    .leftJoinAndSelect('item.token', 'token')
                    .andWhere('item.tokenId = :tokenId', { tokenId })
                    .andWhere('item.status = :status', { status: ItemStatus.Init })
                    .orderBy('item.pricePerToken', sort === SortDirection.Desc ? 'DESC' : 'ASC')
                    .offset(page * limit)
                    .limit(limit)
                    .getMany(),
                this.itemRepository
                    .createQueryBuilder('item')
                    .where('item.status = :status', { status: ItemStatus.Init })
                    .andWhere('item.tokenId = :tokenId', { tokenId })
                    .getCount(),
            ]);
        }
    async queyAddressOrders(myOrdersInput: MyOrdersInput): Promise<[ItemEntity[], number]> {
            let { page, limit } = myOrdersInput;
            let queryBuilder = this.itemRepository.createQueryBuilder('item');
            switch (myOrdersInput.orderType) {
                case MyOrderType.Listing:
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress and item.status = :status', { sellerAddress: myOrdersInput.address, status: ItemStatus.Init });
                    break;
                case MyOrderType.Bought:
                    queryBuilder.andWhere('item.buyerAddress = :buyerAddress and item.isCancel is not :isCancel and item.status not in ( :status) ', {
                        buyerAddress: myOrdersInput.address,
                        isCancel: true,
                        status: [ItemStatus.Init, ItemStatus.Invalid],
                    });
                    break;
                case MyOrderType.SoldOut:
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress and item.isCancel is not :isCancel and item.status not in ( :status) ', {
                        sellerAddress: myOrdersInput.address,
                        isCancel: true,
                        status: [ItemStatus.Init, ItemStatus.Invalid],
                    });
                    break;
                case (OrderType.Unlist as any):
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress  and item.isCancel is :isCancel and item.status not in ( :status)', {
                        sellerAddress: myOrdersInput.address,
                        isCancel: true,
                        status: [ItemStatus.Init, ItemStatus.Invalid],
                    });
                    break;
                default:
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress and item.tokenId = :tokenId  and item.status != :status or item.buyerAddress = :buyerAddress and item.tokenId = :tokenId and item.status != :status', {
                        buyerAddress: myOrdersInput.address,
                        sellerAddress: myOrdersInput.address,
                        tokenId: myOrdersInput.tokenId,
                        status: ItemStatus.Invalid,
                    });
                    break;
            }
            if (myOrdersInput.tokenId && myOrdersInput.orderType != MyOrderType.All) {
                queryBuilder.andWhere('item.tokenId = :tokenId', {
                    tokenId: myOrdersInput.tokenId,
                });
            }
            let countBuilder = queryBuilder;
            queryBuilder
                .leftJoinAndSelect('item.token', 'token')
                .leftJoinAndSelect('item.order', 'order');
            return await Promise.all([
                queryBuilder
                    .orderBy('item.updatedAt', 'DESC')
                    .offset(page * limit)
                    .limit(limit)
                    .getMany(),
                countBuilder.getCount(),
            ]);
        }
    async queyActivities(activities: ActivitiesInputDto): Promise<[ItemEntity[], number]> {
            let { page, limit, activityType, tokenId } = activities;
            let queryBuilder = this.itemRepository
                .createQueryBuilder('item')
                .where({ tokenId });
            switch (activityType) {
                case ActivityType.Sale:
                    queryBuilder.andWhere('item.isCancel is not :isCancel and item.status in (:status)', { isCancel: true, status: [ItemStatus.Pending, ItemStatus.Complete] });
                    break;
                case ActivityType.List:
                    queryBuilder.andWhere('item.status = :status', {
                        status: ItemStatus.Init,
                    });
                    break;
                case ActivityType.Transfer:
                    queryBuilder.andWhere('item.status = :status', {
                        status: ItemStatus.Invalid,
                    });
                    break;
                case ActivityType.Unlist:
                    queryBuilder.andWhere('item.isCancel is :isCancel and item.status in (:status)', { isCancel: true, status: [ItemStatus.Pending, ItemStatus.Complete] });
                    break;
                default:
                    break;
            }
            let countBuilder = queryBuilder;
            queryBuilder
                .leftJoinAndSelect('item.token', 'token')
                .leftJoinAndSelect('item.order', 'order');
            return await Promise.all([
                queryBuilder
                    .orderBy('item.updatedAt', 'DESC')
                    .offset(page * limit)
                    .limit(limit)
                    .getMany(),
                countBuilder.getCount(),
            ]);
        }
    async queyPendingActivities(activitiesPending: OrderPendingInputDto): Promise<[OrderEntity[], number]> {
            let tenMinutesAgo = moment().add(-10, 'minute').toDate();
            let { page, limit } = activitiesPending;
            let queryBuilder = this.orderRepository
                .createQueryBuilder('order')
                .leftJoinAndSelect('order.items', 'items')
                .where('order.createdAt < :tenMinutesAgo and order.status != :status', {
                tenMinutesAgo: tenMinutesAgo,
                status: OrderStatus.ckbComplete,
            });
            let countBuilder = queryBuilder;
            return await Promise.all([
                queryBuilder
                    .orderBy('order.createdAt', 'ASC')
                    .offset(page * limit)
                    .limit(limit)
                    .getMany(),
                countBuilder.getCount(),
            ]);
        }
    async getFloorPriceItem(): Promise<ItemEntity[] | null> {
            let builder = this.itemRepository
                .createQueryBuilder('item')
                .select('item.tokenId', 'tokenId')
                .addSelect('MIN(item.pricePerToken)', 'pricePerToken')
                .where('item.status = :status', {
                status: ItemStatus.Init,
            })
                .groupBy('item.tokenId');
            let data = await builder.getRawMany();
            return data;
        }
    async removeUserRgbppCacheData(address: string): Promise<void> {
            try {
                const cacheKeyPattern = `${this.appConfig.nodeEnv}:Hue:Hub:Asset:Btc:${address}:*{tag}`;
                let cursor = '0';
                do {
                    const reply = await this.redis.scan(cursor, 'MATCH', cacheKeyPattern, 'COUNT', 100);
                    cursor = reply[0];
                    const keysToDelete = reply[1];
                    if (keysToDelete.length > 0) {
                        await this.redis.del(...keysToDelete);
                    }
                } while (cursor !== '0');
            }
            catch (error) {
                this.logger.error(`[removeUserRgbppCacheData] ${(error as Error)?.stack}`);
            }
        }
    async fixMinimalFloorPriceItem(tokenIds: number, time: number): Promise<ItemEntity | null> {
            let startTime = moment(time * 1000)
                .subtract(1, 'day')
                .toDate();
            let endTime = moment(time * 1000).toDate();
            let builder = this.itemRepository
                .createQueryBuilder('item')
                .select('item.pricePerToken')
                .where('item.createdAt <:endTime and item.updatedAt >=:startTime and item.tokenId = :tokenIds and item.isCancel is not :isCancel ', {
                startTime,
                endTime,
                tokenIds,
                isCancel: true,
            })
                .orderBy({ 'item.status': 'ASC', 'item.pricePerToken': 'ASC' })
                .limit(1);
            let data = await builder.getOne();
            this.logger.log(`[fixMinimalFloorPriceItem]${builder.getSql()} ${JSON.stringify({
                startTime,
                endTime,
                tokenIds,
                isCancel: true,
            })},data ${JSON.stringify(data)}`);
            return data;
        }
    async invalidItems(inactiveItems: ItemEntity[]): Promise<void> {
            let ids = inactiveItems.map((item) => item.id);
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const itemList = await manager.find(ItemEntity, {
                    where: {
                        id: In(ids),
                        status: ItemStatus.Init,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                let itemIds = itemList.map((item) => item.id);
                await manager
                    .createQueryBuilder()
                    .update(ItemEntity)
                    .set({ status: ItemStatus.Invalid, updatedAt: new Date() })
                    .where('id IN (:ids)', { ids: itemIds })
                    .execute();
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[invalidItems] error ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
}
