import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ItemEntity, ItemStatus, OrderEntity, OrderStatus, OrderType } from '../../../database/entities';
import { DataSource, In, Repository } from 'typeorm';
import { AppLoggerService } from '../../../common/utils.service/logger.service';
import Decimal from 'decimal.js';
import { StatusName } from '../../../common/utils/error.code';

@Injectable()
export class OrdersDbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(OrderEntity) private orderRepository: Repository<OrderEntity>) {
        this.logger.setContext(OrdersDbService.name);
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
                    item.peningTime = new Date().getTime();
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
                        item.peningTime = null;
                        item.completeTime = null;
                    }
                    if (invalidIds.includes(item.id)) {
                        item.status = ItemStatus.Invalid;
                    }
                    else {
                        item.status = itemStatus;
                        if (itemStatus == ItemStatus.Pending) {
                            item.peningTime = new Date().getTime();
                        }
                        if (itemStatus == ItemStatus.Complete) {
                            item.completeTime = new Date().getTime();
                        }
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
    async findOrderEntity(orderId: number): Promise<OrderEntity | null> {
            let order = await this.orderRepository.findOne({
                where: {
                    id: orderId,
                },
                relations: { items: true },
            });
            return order;
        }
}
