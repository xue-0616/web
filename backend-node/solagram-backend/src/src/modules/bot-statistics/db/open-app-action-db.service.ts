import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppType, OpenActionType, OpenAppActionEntity, OpenSource } from '../../../database/entities/open-app-action.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class OpenAppActionDBService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(OpenAppActionEntity) private openMiniAppRepository: Repository<OpenAppActionEntity>) {
        this.logger.setContext(OpenAppActionDBService.name);
    }
    async findOne(where: FindOptionsWhere<OpenAppActionEntity>): Promise<OpenAppActionEntity | null> {
            return await this.openMiniAppRepository.findOne({ where });
        }
    async findOrInsert(userId: number, action: OpenActionType, appType: AppType, source: OpenSource, replyId: number, blinkId: number): Promise<OpenAppActionEntity | null> {
            let entity = await this.findOne({
                appType,
                action,
                userId,
                source,
                replyId,
            });
            if (entity) {
                return entity;
            }
            entity = new OpenAppActionEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.userId = userId;
            entity.replyId = replyId;
            entity.blinkId = blinkId;
            entity.action = action;
            entity.appType = appType;
            entity.source = source;
            return await this.openMiniAppRepository.save(entity);
        }
}
