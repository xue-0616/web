import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CollectionEntity, DobsEntity, ItemEntity, ItemStatus } from '../../../database/entities';
import { AppLoggerService } from '../../../common/utils.service/logger.service';
import { DataSource, FindOptionsRelations, FindOptionsWhere, In, Repository } from 'typeorm';
import { ItemFloorPrice, ItemStatistic } from '../../../common/interface/statistic';
import { SortDirection } from '../../../modules/collection/dto/collections.input.dto';
import { ListItemInput } from '../../../modules/collection/dto/list.items.input.dto';
import { MyOrdersInput, ShowOrderType } from '../../../modules/collection/dto/my.orders.input.dto';
import { ActivitiesInputDto, ActivityType } from '../../../modules/collection/dto/activities.input.dto';
import Decimal from 'decimal.js';

@Injectable()
export class ItemsDbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(ItemEntity) private itemRepository: Repository<ItemEntity>) {
        this.logger.setContext(ItemsDbService.name);
    }
    async saveEntity(entity: ItemEntity): Promise<ItemEntity | null> {
            return await this.itemRepository.save(entity);
        }
    async findOne(where: FindOptionsWhere<ItemEntity>): Promise<ItemEntity | null> {
            return await this.itemRepository.findOne({ where });
        }
    async remove(itemEntity: ItemEntity): Promise<void> {
            await this.itemRepository.delete(itemEntity.id);
        }
    async getListingAndPendingItemsByAddress(address: string): Promise<ItemEntity[]> {
            let data = await this.itemRepository
                .createQueryBuilder('item')
                .where('item.status in (:statusArray) and seller_address = :sellerAddress', {
                statusArray: [ItemStatus.Init, ItemStatus.Pending],
                sellerAddress: address,
            })
                .getMany();
            return data;
        }
    async getAllTotalSaleCountAndVolume(collectionId: number[]): Promise<ItemStatistic[]> {
            if (collectionId.length == 0) {
                return [];
            }
            let data = await this.itemRepository
                .createQueryBuilder('item')
                .select('item.collectionId', 'collectionId')
                .addSelect('SUM(item.price)', 'totalVolume')
                .addSelect('count(item.id)', 'salesCount')
                .where('item.status = :status  AND item.isCancel is not :isCancel and item.collectionId in (:collectionId)', {
                status: ItemStatus.Complete,
                isCancel: true,
                collectionId,
            })
                .groupBy('item.collectionId')
                .getRawMany();
            let list = data.map((item) => {
                return {
                    collectionId: item.collectionId,
                    totalVolume: item.totalVolume,
                    salesCount: item.salesCount,
                };
            });
            return list;
        }
    async getAllMinimalFloorPriceItem(collectionId: number[]): Promise<ItemFloorPrice[]> {
            if (collectionId.length == 0) {
                return [];
            }
            let builder = this.itemRepository
                .createQueryBuilder('item')
                .select('item.collectionId', 'collectionId')
                .addSelect('MIN(item.price)', 'price')
                .where('item.status = :status and item.collectionId IN (:...collectionId)', {
                status: ItemStatus.Init,
                collectionId,
            })
                .groupBy('item.collectionId');
            let data = await builder.getRawMany();
            return data;
        }
    async getItemsPaginated(collectionId: number, sort: SortDirection, limit: number, page: number): Promise<[ItemEntity[], number]> {
            return await Promise.all([
                this.itemRepository
                    .createQueryBuilder('item')
                    .leftJoinAndSelect('item.dobs', 'dobs')
                    .andWhere('item.collectionId = :collectionId', { collectionId })
                    .andWhere('item.status = :status', { status: ItemStatus.Init })
                    .orderBy('item.price', sort === SortDirection.Desc ? 'DESC' : 'ASC')
                    .offset(page * limit)
                    .limit(limit)
                    .getMany(),
                this.itemRepository
                    .createQueryBuilder('item')
                    .where('item.status = :status', { status: ItemStatus.Init })
                    .andWhere('item.collectionId = :collectionId', { collectionId })
                    .getCount(),
            ]);
        }
    async queryItem(where: FindOptionsWhere<ItemEntity>): Promise<ItemEntity | null> {
            return await this.itemRepository.findOne({ where });
        }
    initItemEntity(collection: CollectionEntity, dobsCell: DobsEntity, address: string, item: ListItemInput): ItemEntity {
            let entity = new ItemEntity();
            entity.collectionId = collection.id;
            entity.sellerAddress = address;
            entity.price = item.price;
            entity.price = item.price;
            entity.txHash = item.txHash;
            entity.index = item.index;
            entity.unsignedPsbt = item.psbt;
            entity.psbtSig = item.psbtSig;
            entity.btcValue = new Decimal(dobsCell.btcValue);
            entity.status = ItemStatus.Init;
            entity.dobsId = dobsCell.id;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            return entity;
        }
    async batchInsertItem(entity: ItemEntity[]): Promise<ItemEntity[]> {
            return await this.itemRepository.save(entity);
        }
    async findItems(where: FindOptionsWhere<ItemEntity> | FindOptionsWhere<ItemEntity>[], relations: FindOptionsRelations<ItemEntity>): Promise<ItemEntity[]> {
            return await this.itemRepository.find({
                where,
                relations,
                order: { id: 'desc' },
            });
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
    async queyAddressOrders(address: string, myOrdersInput: MyOrdersInput, collection: CollectionEntity | undefined): Promise<[ItemEntity[], number]> {
            let { page, limit } = myOrdersInput;
            let queryBuilder = this.itemRepository.createQueryBuilder('item');
            switch (myOrdersInput.orderType) {
                case ShowOrderType.Listing:
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress and item.status = :status', { sellerAddress: address, status: ItemStatus.Init });
                    break;
                case ShowOrderType.Bought:
                    queryBuilder.andWhere('item.buyerAddress = :buyerAddress and item.isCancel is not :isCancel and item.status not in ( :status) ', {
                        buyerAddress: address,
                        isCancel: true,
                        status: [ItemStatus.Init, ItemStatus.Invalid],
                    });
                    break;
                case ShowOrderType.SoldOut:
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress and item.isCancel is not :isCancel and item.status not in ( :status) ', {
                        sellerAddress: address,
                        isCancel: true,
                        status: [ItemStatus.Init, ItemStatus.Invalid],
                    });
                    break;
                case ShowOrderType.Unlist:
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress  and item.isCancel is :isCancel and item.status not in ( :status)', {
                        sellerAddress: address,
                        isCancel: true,
                        status: [ItemStatus.Init, ItemStatus.Invalid],
                    });
                    break;
                default:
                    queryBuilder.andWhere('item.sellerAddress = :sellerAddress and item.status != :status or item.buyerAddress = :buyerAddress and item.status != :status', {
                        buyerAddress: address,
                        sellerAddress: address,
                        status: ItemStatus.Invalid,
                    });
                    break;
            }
            if (collection && myOrdersInput.orderType != ShowOrderType.All) {
                queryBuilder.andWhere('item.collectionId = :collectionId', {
                    collectionId: collection.id,
                });
            }
            let countBuilder = queryBuilder;
            queryBuilder
                .leftJoinAndSelect('item.collection', 'collection')
                .leftJoinAndSelect('item.dobs', 'dobs')
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
    async queyActivities(activities: ActivitiesInputDto, collection: CollectionEntity): Promise<[ItemEntity[], number]> {
            let { page, limit, activityType } = activities;
            let queryBuilder = this.itemRepository
                .createQueryBuilder('item')
                .where({ collectionId: collection.id });
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
                .leftJoinAndSelect('item.collection', 'collection')
                .leftJoinAndSelect('item.dobs', 'dobs')
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
}
