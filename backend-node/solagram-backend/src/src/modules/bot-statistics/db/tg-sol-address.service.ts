import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TgSolAddressEntity } from '../../../database/entities/tg-sol-address.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class TgSolAddressDBService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(TgSolAddressEntity) private tgSolAddressRepository: Repository<TgSolAddressEntity>) {
        this.logger.setContext(TgSolAddressDBService.name);
    }
    async findOne(where: FindOptionsWhere<TgSolAddressEntity>): Promise<TgSolAddressEntity> {
            return await this.tgSolAddressRepository.findOne({ where });
        }
    async find(where: FindOptionsWhere<TgSolAddressEntity>): Promise<TgSolAddressEntity[]> {
            return await this.tgSolAddressRepository.find({ where });
        }
    async findOrInsert(userId: number, address: string): Promise<TgSolAddressEntity> {
            let entity = await this.findOne({ userId, address });
            if (entity) {
                return entity;
            }
            entity = new TgSolAddressEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.address = address;
            entity.userId = userId;
            entity = await this.tgSolAddressRepository.save(entity);
            return entity;
        }
}
