import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BotGroupsEntity, JoinInStatus } from '../../../database/entities/bot-group.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from 'node-telegram-bot-api';

@Injectable()
export class BotGroupsDBService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(BotGroupsEntity) private botGroupsRepository: Repository<BotGroupsEntity>) {
        this.logger.setContext(BotGroupsDBService.name);
    }
    async findOne(where: FindOptionsWhere<BotGroupsEntity>): Promise<BotGroupsEntity | null> {
            return await this.botGroupsRepository.findOne({ where });
        }
    async findOrInsert(chatId: number, groupTitle: string, status: JoinInStatus, botUser: User): Promise<void> {
            let entity = await this.findOne({ chatId, botId: botUser.id });
            if (entity) {
                if (entity.status !== status) {
                    entity.status = status;
                    await this.botGroupsRepository.save(entity);
                }
                return;
            }
            entity = new BotGroupsEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.chatId = chatId;
            entity.botUsername = botUser.username ?? '';
            entity.botId = botUser.id;
            entity.groupTitle = groupTitle;
            entity.status = status;
            await this.botGroupsRepository.save(entity);
        }
}
