import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MysteryBoxEntity, MysteryBoxStatus } from '../../database/entities/mystery-boxs.entity';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';
import { PublicKey } from '@solana/web3.js';

@Injectable()
export class MysteryBoxDbService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(MysteryBoxEntity) private mysteryBoxEntityEntity: Repository<MysteryBoxEntity>) {
        this.logger.setContext(MysteryBoxDbService.name);
    }
    async findOne(where: FindOptionsWhere<MysteryBoxEntity>, relations?: FindOptionsRelations<MysteryBoxEntity>): Promise<MysteryBoxEntity | null> {
            return await this.mysteryBoxEntityEntity.findOne({ where, relations });
        }
    async find(where: FindOptionsWhere<MysteryBoxEntity>, relations: FindOptionsRelations<MysteryBoxEntity>, skip: number = 0, take: number = 10): Promise<MysteryBoxEntity[]> {
            return await this.mysteryBoxEntityEntity.find({
                where,
                relations,
                skip,
                take,
                order: { createdAt: 'DESC' },
            });
        }
    async insert(creator: PublicKey, boxAmount: bigint, bombNumber: number, openLimit: bigint): Promise<MysteryBoxEntity | null> {
            const mysteryBox = new MysteryBoxEntity();
            mysteryBox.createdAt = new Date();
            mysteryBox.updatedAt = new Date();
            mysteryBox.senderAddress = creator.toString();
            mysteryBox.status = MysteryBoxStatus.INIT;
            mysteryBox.amount = boxAmount.toString();
            mysteryBox.bombNumber = bombNumber;
            mysteryBox.openLimit = openLimit;
            mysteryBox.openCount = 0n;
            return await this.mysteryBoxEntityEntity.save(mysteryBox);
        }
}
