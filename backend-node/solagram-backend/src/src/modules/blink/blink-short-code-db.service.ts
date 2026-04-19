import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BlinkShortCodeEntity } from '../../database/entities/blink-short-code.entity';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';
import { generateShortCode } from '../../common/utils/tools';

@Injectable()
export class BlinkShortCodeDBService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(BlinkShortCodeEntity) private blinkShortCodeRepository: Repository<BlinkShortCodeEntity>) {
        this.logger.setContext(BlinkShortCodeDBService.name);
    }
    async save(entity: BlinkShortCodeEntity): Promise<BlinkShortCodeEntity | null> {
            return await this.blinkShortCodeRepository.save(entity);
        }
    async findOne(where: FindOptionsWhere<BlinkShortCodeEntity>): Promise<BlinkShortCodeEntity | null> {
            return await this.blinkShortCodeRepository.findOne({ where });
        }
    async findOrInsert(blink: string, domain: string): Promise<BlinkShortCodeEntity | null> {
            let entity = await this.findOne({ blink });
            if (entity) {
                return await this.updateExistingEntity(entity, domain);
            }
            entity = new BlinkShortCodeEntity();
            entity.blink = blink;
            entity.domain = domain;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity = await this.blinkShortCodeRepository.save(entity);
            entity.shortCode = generateShortCode(entity.id);
            await this.blinkShortCodeRepository.update(entity.id, {
                shortCode: entity.shortCode,
            });
            return entity;
        }
    async updateExistingEntity(entity: any, domain: any) {
            const updates: any = {};
            if (!entity.shortCode || entity.shortCode.length >= 32) {
                updates.shortCode = generateShortCode(entity.id);
                entity.shortCode = updates.shortCode;
            }
            if (entity.domain !== domain) {
                updates.domain = domain;
                entity.domain = domain;
            }
            if (Object.keys(updates).length > 0) {
                await this.blinkShortCodeRepository.update(entity.id, updates);
            }
            return entity;
        }
}
