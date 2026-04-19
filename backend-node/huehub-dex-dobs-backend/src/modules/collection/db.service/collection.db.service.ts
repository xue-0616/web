import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CollectionEntity } from '../../../database/entities';
import { AppLoggerService } from '../../../common/utils.service/logger.service';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { ItemsDbService } from '../../../modules/market/db.service.ts/item.db.service';
import Decimal from 'decimal.js';

@Injectable()
export class CollectionDbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, private readonly itemsDbService: ItemsDbService, @InjectRepository(CollectionEntity) private readonly collectionRepository: Repository<CollectionEntity>) {
        this.logger.setContext(CollectionDbService.name);
    }
    async saveEntity(entity: CollectionEntity): Promise<CollectionEntity | null> {
            return await this.collectionRepository.save(entity);
        }
    async findOne(where: FindOptionsWhere<CollectionEntity>): Promise<CollectionEntity | null> {
            return await this.collectionRepository.findOne({ where });
        }
    async find(where: FindOptionsWhere<CollectionEntity>, skip?: number, take?: number): Promise<CollectionEntity[]> {
            return await this.collectionRepository.find({ where, skip, take });
        }
    async updateCollectionFloorPrice(collectionEntity: CollectionEntity): Promise<void> {
            try {
                let floorItems = await this.itemsDbService.getAllMinimalFloorPriceItem([
                    collectionEntity.id,
                ]);
                collectionEntity.floorPrice = new Decimal(floorItems.length > 0 ? floorItems[0].price : 0);
                collectionEntity.marketCap = collectionEntity.totalSupply
                    .div(Decimal.pow(10, collectionEntity.decimals))
                    .mul(collectionEntity.floorPrice);
                (collectionEntity.updatedAt = new Date()),
                    await this.saveEntity(collectionEntity);
            }
            catch (error) {
                this.logger.error(`[updateTokenFloorPrice] error: ${(error as Error)?.stack}}`);
            }
        }
}
