import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GrabMysteryBoxEntity, GrabTransactionStatus } from '../../database/entities/grab-mystery-boxs.entity';
import { MysteryBoxEntity } from '../../database/entities/mystery-boxs.entity';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { DataSource, FindOptionsWhere, MoreThanOrEqual, Repository } from 'typeorm';
import { PublicKey } from '@solana/web3.js';
import { AppConfigService } from '../../common/utils-service/app.config.services';

@Injectable()
export class GrabMysteryBoxDbService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(GrabMysteryBoxEntity) private garbMysteryBoxEntity: Repository<GrabMysteryBoxEntity>, private readonly appConfig: AppConfigService, private readonly dataSource: DataSource) {
        this.logger.setContext(GrabMysteryBoxDbService.name);
    }
    async findOne(where: FindOptionsWhere<GrabMysteryBoxEntity>): Promise<GrabMysteryBoxEntity | null> {
            return await this.garbMysteryBoxEntity.findOne({ where });
        }
    async find(where: FindOptionsWhere<GrabMysteryBoxEntity>): Promise<GrabMysteryBoxEntity[]> {
            return await this.garbMysteryBoxEntity.find({ where });
        }
    /**
     * BUG-M4 (MEDIUM) fix: serialise concurrent inserts for the same
     * box with a row-level `pessimistic_write` lock on the mystery_boxs
     * row. The previous implementation performed `count` and `save` in
     * separate statements, so two parallel calls could both see
     * `grabs < limit` and both insert, pushing the row count past the
     * cap. With the lock, only one caller can enter the critical
     * section for a given boxId at a time; different boxes still
     * proceed in parallel.
     */
    async insert(boxId: bigint, creator: PublicKey, boxAmount: bigint): Promise<GrabMysteryBoxEntity | null> {
            const limit = this.appConfig.actionInfo.totalBoxCount;
            return await this.dataSource.transaction(async (manager) => {
                // Lock the box row first so concurrent grabs on the same
                // box serialise. Use findOne rather than query because it
                // maps cleanly through TypeORM's lock modes.
                const boxRow = await manager.findOne(MysteryBoxEntity, {
                    where: { id: boxId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!boxRow) {
                    this.logger.warn(`[insert] box ${boxId} not found`);
                    return null;
                }
                const grabs = await manager.count(GrabMysteryBoxEntity, {
                    where: {
                        boxId,
                        status: MoreThanOrEqual(GrabTransactionStatus.CONFIRMED),
                    },
                });
                if (grabs >= limit) {
                    this.logger.warn(`[insert] grabs length maximum limit ${limit}`);
                    return null;
                }
                const garbMysteryBox = new GrabMysteryBoxEntity();
                garbMysteryBox.createdAt = new Date();
                garbMysteryBox.updatedAt = new Date();
                garbMysteryBox.boxId = boxId;
                garbMysteryBox.senderAddress = creator.toString();
                garbMysteryBox.status = GrabTransactionStatus.INIT;
                garbMysteryBox.amount = boxAmount.toString();
                return await manager.save(garbMysteryBox);
            });
        }
}
