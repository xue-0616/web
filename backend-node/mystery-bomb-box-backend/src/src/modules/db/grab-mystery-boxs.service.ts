import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GrabMysteryBoxEntity, GrabTransactionStatus } from '../../database/entities/grab-mystery-boxs.entity';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';
import { PublicKey } from '@solana/web3.js';
import { AppConfigService } from '../../common/utils-service/app.config.services';

@Injectable()
export class GrabMysteryBoxDbService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(GrabMysteryBoxEntity) private garbMysteryBoxEntity: Repository<GrabMysteryBoxEntity>, private readonly appConfig: AppConfigService) {
        this.logger.setContext(GrabMysteryBoxDbService.name);
    }
    async findOne(where: FindOptionsWhere<GrabMysteryBoxEntity>): Promise<GrabMysteryBoxEntity | null> {
            return await this.garbMysteryBoxEntity.findOne({ where });
        }
    async find(where: FindOptionsWhere<GrabMysteryBoxEntity>): Promise<GrabMysteryBoxEntity[]> {
            return await this.garbMysteryBoxEntity.find({ where });
        }
    async insert(boxId: bigint, creator: PublicKey, boxAmount: bigint): Promise<GrabMysteryBoxEntity | null> {
            const grabs = await this.garbMysteryBoxEntity.count({
                where: {
                    boxId,
                    status: MoreThanOrEqual(GrabTransactionStatus.CONFIRMED),
                },
            });
            if (grabs >= this.appConfig.actionInfo.totalBoxCount) {
                this.logger.warn(`[insert] grabs length maximum limit ${this.appConfig.actionInfo.totalBoxCount}`);
                return null;
            }
            const garbMysteryBox = new GrabMysteryBoxEntity();
            garbMysteryBox.createdAt = new Date();
            garbMysteryBox.updatedAt = new Date();
            garbMysteryBox.boxId = boxId;
            garbMysteryBox.senderAddress = creator.toString();
            garbMysteryBox.status = GrabTransactionStatus.INIT;
            garbMysteryBox.amount = boxAmount.toString();
            return await this.garbMysteryBoxEntity.save(garbMysteryBox);
        }
}
