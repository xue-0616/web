import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthStatus, AuthType, AuthenticatorsEntity } from '../../entities';
import { getConnection } from 'typeorm';

@Injectable()
export class AuthenticatorsDBService {
    constructor(logger: any, @InjectRepository(AuthenticatorsEntity) authenticatorsRepository: any) {
        this.logger = logger;
        this.authenticatorsRepository = authenticatorsRepository;
        this.logger.setContext(AuthenticatorsDBService.name);
    }
    logger: any;
    authenticatorsRepository: any;
    async findOne(where: any) {
            const data = await this.authenticatorsRepository.findOne({ where });
            return data;
        }
    async findMany(where: any) {
            const data = await this.authenticatorsRepository.find({ where });
            return data;
        }
    async deleteOne(where: any) {
            await this.authenticatorsRepository.delete(where);
        }
    async updateDB(id: any, update: any) {
            await this.authenticatorsRepository.update(id, update);
        }
    async updateManyDB(accountId: any, type: any, update: any) {
            await getConnection()
                .createQueryBuilder()
                .update(AuthenticatorsEntity)
                .set(update)
                .where('accountId = :accountId and status != 2 and type =:type', {
                accountId,
                type,
            })
                .execute();
        }
    async insertDB(accountId: any, value: any, type: any) {
            const data = await this.findOne({ accountId, type });
            if (data && data.type !== AuthType.WebAuthn) {
                if (data.value !== value) {
                    const update = {
                        value,
                        updatedAt: new Date(),
                        status: AuthStatus.Open,
                    };
                    await this.updateDB(data.id, update);
                }
                return true;
            }
            const entity = new AuthenticatorsEntity();
            entity.accountId = accountId;
            entity.value = value;
            entity.type = type;
            entity.status = AuthStatus.Open;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            try {
                await this.authenticatorsRepository.insert(entity);
            }
            catch (error) {
                this.logger.warn(`[insertDB]${error}, entry = ${JSON.stringify(entity)}`);
                return false;
            }
            return true;
        }
}
