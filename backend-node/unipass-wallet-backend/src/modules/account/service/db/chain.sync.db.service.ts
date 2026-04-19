import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChainSyncEntity } from '../../entities/chain.sync.entity';

@Injectable()
export class ChainSyncDBService {
    constructor(logger: any, @InjectRepository(ChainSyncEntity) chainSyncEntity: any) {
        this.logger = logger;
        this.chainSyncEntity = chainSyncEntity;
        this.logger.setContext(ChainSyncDBService.name);
    }
    logger: any;
    chainSyncEntity: any;
    async findOne(where: any) {
            const data = await this.chainSyncEntity.findOne({ where });
            return data;
        }
    async updateDB(id: any, update: any) {
            await this.chainSyncEntity.update(id, update);
        }
    async insertDB(accountId: any, transactionJson: any, metaNonce: any) {
            const data = await this.findOne({ accountId, metaNonce });
            if (data) {
                const update = {
                    transactionJson,
                    updatedAt: new Date(),
                };
                await this.updateDB(data.id, update);
                return true;
            }
            const entity = new ChainSyncEntity();
            entity.accountId = accountId;
            entity.transactionJson = transactionJson;
            entity.metaNonce = metaNonce;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            try {
                this.logger.log(`[insertDB] ChainSyncDBService entity = ${JSON.stringify(entity)}`);
                await this.chainSyncEntity.insert(entity);
            }
            catch (error) {
                this.logger.warn(`[insertDB] ${error}, entry = ${JSON.stringify(entity)}`);
                return false;
            }
            return true;
        }
}
