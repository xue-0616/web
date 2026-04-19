import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FollowStatus, FollowType, UserFollowsEntity } from '../../../database/entities/user-follows.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from 'node-telegram-bot-api';

@Injectable()
export class UserFollowDBService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(UserFollowsEntity) private userFollowRepository: Repository<UserFollowsEntity>) {
        this.logger.setContext(UserFollowDBService.name);
    }
    async findOne(where: FindOptionsWhere<UserFollowsEntity>): Promise<UserFollowsEntity | null> {
            return await this.userFollowRepository.findOne({ where });
        }
    async findOrInsert(userId: number, type: FollowType, status: FollowStatus, botUser: User): Promise<UserFollowsEntity | null> {
            let entity = await this.findOne({ userId, type });
            if (entity) {
                return entity;
            }
            entity = new UserFollowsEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.type = type;
            entity.botUsername = botUser?.username ?? '';
            entity.botId = botUser?.id;
            entity.userId = userId;
            entity.status = status;
            entity = await this.userFollowRepository.save(entity);
            return entity;
        }
}
