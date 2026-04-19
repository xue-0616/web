import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KeyListEntity, KeyStatus } from '../entities/key.list.entity';
import { KeyType } from '../../../interfaces';

@Injectable()
export class KeyDBService {
    constructor(logger: any, @InjectRepository(KeyListEntity) keyRepository: any) {
        this.logger = logger;
        this.keyRepository = keyRepository;
        this.logger.setContext(KeyDBService.name);
    }
    logger: any;
    keyRepository: any;
    async findOne(where: any) {
            const data = await this.keyRepository.findOne({ where });
            return data;
        }
    async insertDB(accountId: any, keyStore: any, address: any, status: any = KeyStatus.pending, uuid: any, keyType: any = KeyType.MPC, web3AuthAddress: any) {
            const data = await this.findOne({ accountId, address });
            if (data) {
                if (data.status !== status) {
                    const update = {
                        keystore: keyStore,
                        keyType,
                        status,
                        web3AuthAddress,
                        updatedAt: new Date(),
                    };
                    await this.updateDB(data.id, update);
                }
                return true;
            }
            const entity = new KeyListEntity();
            entity.accountId = accountId;
            entity.address = address;
            entity.keystore = keyStore;
            entity.status = status;
            entity.web3AuthAddress = web3AuthAddress;
            entity.keyType = keyType;
            entity.uuid = uuid;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            try {
                await this.keyRepository.insert(entity);
            }
            catch (error) {
                this.logger.warn(`[insertDB] ${error}, entry = ${JSON.stringify(entity)}`);
                return false;
            }
            return true;
        }
    async updateDB(id: any, update: any) {
            await this.keyRepository.update(id, update);
        }
}
