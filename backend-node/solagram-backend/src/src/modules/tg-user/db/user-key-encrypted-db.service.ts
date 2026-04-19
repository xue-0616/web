import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KeyUsedStatus, UserKeyEncryptsEntity } from '../../../database/entities/user-key-encrypted.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { FindOptionsWhere, Repository } from 'typeorm';
import { SaveEncryptedKeyInputDto } from '../dto/save.encrypted.key.input.dto';

@Injectable()
export class UserKeyEncryptedDbService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(UserKeyEncryptsEntity) private userKeyEncryptedRepository: Repository<UserKeyEncryptsEntity>) {
        this.logger.setContext(UserKeyEncryptedDbService.name);
    }
    async findOne(where: FindOptionsWhere<UserKeyEncryptsEntity>): Promise<UserKeyEncryptsEntity> {
            return await this.userKeyEncryptedRepository.findOne({ where });
        }
    async findOrInsert(userId: number, input: SaveEncryptedKeyInputDto): Promise<UserKeyEncryptsEntity> {
            let entity = await this.findOne({ address: input.address });
            if (entity) {
                return entity;
            }
            entity = new UserKeyEncryptsEntity();
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            entity.userId = userId;
            entity.address = input.address;
            entity.status = KeyUsedStatus.NewKey;
            entity.keyEncrypted = input.keyEncrypted;
            entity = await this.userKeyEncryptedRepository.save(entity);
            await this.updateStatus(entity);
        }
    async updateStatus(entity: UserKeyEncryptsEntity): Promise<void> {
            if (!entity) {
                return;
            }
            try {
                await this.userKeyEncryptedRepository
                    .createQueryBuilder()
                    .update(UserKeyEncryptsEntity)
                    .set({ status: KeyUsedStatus.OldKey })
                    .where('id != :id and user_id =:userId', {
                    id: entity.id,
                    userId: entity.userId,
                })
                    .execute();
            }
            catch (error) {
                this.logger.error(`[updateStatus] error ${error?.stack}`);
            }
        }
}
