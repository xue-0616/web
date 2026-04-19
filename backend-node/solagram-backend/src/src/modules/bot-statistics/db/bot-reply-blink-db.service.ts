import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BotReplyBlinkEntity } from '../../../database/entities/bot-reply-blink.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from 'node-telegram-bot-api';

@Injectable()
export class BotReplyBlinkDBService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(BotReplyBlinkEntity) private botReplyBlinkRepository: Repository<BotReplyBlinkEntity>) {
        this.logger.setContext(BotReplyBlinkDBService.name);
    }
    async findOne(where: FindOptionsWhere<BotReplyBlinkEntity>): Promise<BotReplyBlinkEntity | null> {
            return await this.botReplyBlinkRepository.findOne({ where });
        }
    async findOrInsert(messageId: number, chatId: number, blinkId: number, from: User, botUser: User): Promise<BotReplyBlinkEntity | null> {
            let entity = await this.findOne({ messageId, chatId });
            if (entity) {
                return entity;
            }
            entity = new BotReplyBlinkEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.messageId = messageId;
            entity.chatId = chatId;
            entity.blinkId = blinkId;
            entity.userId = from.id;
            entity.botId = botUser.id;
            entity = await this.botReplyBlinkRepository.save(entity);
            return entity;
        }
}
