import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TgUserEntity } from '../../../database/entities/tg-user.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';
import { User } from 'node-telegram-bot-api';

@Injectable()
export class TgUserDBService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(TgUserEntity) private tgUserRepository: Repository<TgUserEntity>) {
        this.logger.setContext(TgUserDBService.name);
    }
    async findOne(where: FindOptionsWhere<TgUserEntity> | FindOptionsWhere<TgUserEntity>[], relations?: FindOptionsRelations<TgUserEntity>): Promise<TgUserEntity | null> {
            return await this.tgUserRepository.findOne({ where, relations });
        }
    async findOrInsert(user: User): Promise<TgUserEntity | null> {
            let entity = await this.findOne({ userId: user.id });
            if (entity) {
                return entity;
            }
            entity = new TgUserEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.userId = user.id;
            entity.isBot = user.is_bot;
            entity.firstName = user.first_name;
            entity.lastName = user.last_name ?? '';
            entity.username = user.username ?? '';
            entity = await this.tgUserRepository.save(entity);
            return entity;
        }
}
