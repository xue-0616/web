import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OriHashEntity } from '../../entities';
import { StatusName } from '../../../../shared/utils';

@Injectable()
export class OriHashDBService {
    constructor(logger: any, @InjectRepository(OriHashEntity) oriHashRepository: any) {
        this.logger = logger;
        this.oriHashRepository = oriHashRepository;
        this.logger.setContext(OriHashDBService.name);
    }
    logger: any;
    oriHashRepository: any;
    async findOne(where: any) {
            const data = await this.oriHashRepository.findOne({ where });
            return data;
        }
    async insertDB(raw: any, alg: any, hash: any) {
            const data = await this.findOne({ raw });
            if (data) {
                return true;
            }
            const entity = new OriHashEntity();
            entity.raw = raw;
            entity.hash = hash;
            entity.alg = alg;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            try {
                await this.oriHashRepository.insert(entity);
            }
            catch (error) {
                this.logger.warn(`[insertDB] ${error}, entry = ${JSON.stringify(entity)}`);
                return false;
            }
            return true;
        }
    async getKeyset(keysetHash: any) {
            const oriHashData = await this.findOne({
                hash: keysetHash,
            });
            if (!oriHashData) {
                this.logger.error(`[getKeyset] account key hash db not find ${keysetHash}`);
                throw new BadRequestException(StatusName.KEYSET_NOT_EXISTS);
            }
            const keyset = oriHashData.raw;
            return keyset;
        }
}
