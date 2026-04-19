import { AppLoggerService } from '../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TgUserEntity } from '../../database/entities/tg-user.entity';
import { PointsInputDto } from './dto/points-input.dto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { generateInviteCode } from '../../common/utils/tools';

@Injectable()
export class TgUserDBService {
    constructor(
        private readonly logger: AppLoggerService,
        @InjectRepository(TgUserEntity) private readonly tgUserRepository: Repository<TgUserEntity>,
    ) {
        this.logger.setContext(TgUserDBService.name);
    }
    async findOne(where: FindOptionsWhere<TgUserEntity>): Promise<TgUserEntity | null> {
        return await this.tgUserRepository.findOne({ where });
    }
    async save(entity: TgUserEntity): Promise<TgUserEntity> {
        return await this.tgUserRepository.save(entity);
    }
    async initEntity(input: any): Promise<TgUserEntity> {
        let entity = new TgUserEntity();
        entity.createdAt = new Date();
        entity.updatedAt = new Date();
        entity.accessHash = input.accessHash;
        entity.userId = input.id;
        entity.firstName = input.firstName;
        entity.lastName = input.lastName;
        entity.username = input.username;
        entity = await this.generateInviteCode(entity);
        entity = await this.save(entity);
        return entity;
    }
    async generateInviteCode(entity: TgUserEntity, depth = 0): Promise<TgUserEntity> {
        // SECURITY FIX (BUG-24): Add recursion depth limit to prevent stack overflow crash
        // if the invite code space is saturated. Maximum 10 retries before throwing an error.
        const MAX_RETRIES = 10;
        if (depth >= MAX_RETRIES) {
            this.logger.error(`[generateInviteCode] Failed to generate unique invite code after ${MAX_RETRIES} attempts for userId=${entity.userId}`);
            throw new Error(`Failed to generate unique invite code after ${MAX_RETRIES} attempts`);
        }
        let newCode = generateInviteCode(entity.userId);
        let newCodeEntity = await this.findOne({ inviteCode: newCode });
        if (newCodeEntity) {
            return this.generateInviteCode(entity, depth + 1);
        }
        entity.inviteCode = newCode;
        return entity;
    }
}
