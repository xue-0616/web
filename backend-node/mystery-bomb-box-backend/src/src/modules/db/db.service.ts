import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity, TransactionStatus, TransactionType } from '../../database/entities/transaction.entity';
import { MysteryBoxEntity, MysteryBoxStatus } from '../../database/entities/mystery-boxs.entity';
import { GrabMysteryBoxEntity, GrabTransactionStatus } from '../../database/entities/grab-mystery-boxs.entity';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { DataSource, In, Repository } from 'typeorm';
type Transaction = { tx: any; recentBlockHeight: any };
import { ILotteryDrawResults } from '../../common/interface/lottery-draw-mystery-box';
import { VersionedBlockResponse } from '@solana/web3.js';
import { encode } from 'bs58';

@Injectable()
export class DbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(TransactionEntity) private transactionEntity: Repository<TransactionEntity>, @InjectRepository(MysteryBoxEntity) private mysteryBoxEntity: Repository<MysteryBoxEntity>, @InjectRepository(GrabMysteryBoxEntity) private grabMysteryBoxEntity: Repository<GrabMysteryBoxEntity>) {
        this.logger.setContext(DbService.name);
    }
    async generateMysteryBox(mysteryBox: MysteryBoxEntity, tx: Transaction): Promise<{
        box: MysteryBoxEntity;
        tx: TransactionEntity;
    }> {
            const queryRunner = this.dataSource.createQueryRunner();
            const { tx: solanaTx, recentBlockHeight } = tx;
            let transaction = new TransactionEntity();
            transaction.createdAt = new Date();
            transaction.updatedAt = new Date();
            transaction.txBody = Buffer.from(solanaTx.serialize());
            transaction.txOrderId = BigInt(mysteryBox.id);
            transaction.txBlockHeight = BigInt(recentBlockHeight);
            transaction.status = TransactionStatus.Pending;
            transaction.txOrderType = TransactionType.CreateMysteryBox;
            await queryRunner.connect();
            await queryRunner.startTransaction();
            const manager = queryRunner.manager;
            try {
                transaction = await manager.save(transaction);
                mysteryBox.updatedAt = new Date();
                mysteryBox.status = MysteryBoxStatus.INIT_PENDING;
                mysteryBox.transactionId = transaction.id;
                mysteryBox = await manager.save(mysteryBox);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[generateMysteryBox] error ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return { box: mysteryBox, tx: transaction };
        }
    async successCreateMysteryBox(boxId: bigint, slotId: bigint, slot: VersionedBlockResponse, txSig: Buffer): Promise<{
        box: MysteryBoxEntity;
    }> {
            let box = await this.mysteryBoxEntity.findOne({
                where: { id: boxId },
            });
            if (!box) {
                throw new Error(`MysteryBoxEntity with id ${boxId} not found`);
            }
            const slotIndex = slot.transactions.findIndex((tx) => tx.transaction.signatures[0] === encode(txSig));
            switch (box.status) {
                case MysteryBoxStatus.INIT:
                case MysteryBoxStatus.INIT_PENDING: {
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    try {
                        await queryRunner.startTransaction();
                        const manager = queryRunner.manager;
                        await manager.update(TransactionEntity, { id: box.transactionId }, {
                            status: TransactionStatus.Success,
                            slot: slotId,
                            slotIndex: BigInt(slotIndex),
                            txSig,
                            updatedAt: new Date(),
                        });
                        box.status = MysteryBoxStatus.GRABBING;
                        box.updatedAt = new Date();
                        box = await manager.save(box);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw new Error(`[successMysteryBoxByTxId] Failed to update mystery box status: ${(error as Error).message}`);
                    }
                    finally {
                        await queryRunner.release();
                    }
                    break;
                }
                case MysteryBoxStatus.INIT_FAILED: {
                    throw new Error(`MysteryBoxEntity with id ${box.id} status is INIT_FAILED`);
                }
                default:
                    break;
            }
            return { box };
        }
    async failCreateMysteryBox(boxId: bigint, errorReason: string, txSig: Buffer | null): Promise<{
        box: MysteryBoxEntity;
    }> {
            let box = await this.mysteryBoxEntity.findOne({
                where: { id: boxId },
            });
            if (!box) {
                throw new Error(`MysteryBoxEntity with id ${boxId} not found`);
            }
            switch (box.status) {
                case MysteryBoxStatus.INIT:
                case MysteryBoxStatus.INIT_PENDING: {
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    try {
                        await queryRunner.startTransaction();
                        const manager = queryRunner.manager;
                        await manager.update(TransactionEntity, { id: box.transactionId }, {
                            status: TransactionStatus.Failed,
                            errorReason,
                            txSig,
                            updatedAt: new Date(),
                        });
                        box.status = MysteryBoxStatus.INIT_FAILED;
                        box.updatedAt = new Date();
                        box = await manager.save(box);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw new Error(`[failMysteryBoxByTxId] Failed to update mystery box status: ${(error as Error).message}`);
                    }
                    finally {
                        await queryRunner.release();
                    }
                    break;
                }
                case MysteryBoxStatus.INIT_FAILED: {
                    break;
                }
                default: {
                    throw new Error(`MysteryBoxEntity with id ${box.id} status is ${box.status}`);
                }
            }
            return { box };
        }
    async successGrabMysteryBox(boxId: bigint, grabId: bigint, slotId: bigint, slot: VersionedBlockResponse, txSig: Buffer): Promise<{
        grab: GrabMysteryBoxEntity;
        box: MysteryBoxEntity;
    }> {
            let [grab, box] = await Promise.all([
                this.grabMysteryBoxEntity.findOne({
                    where: { id: grabId },
                }),
                this.mysteryBoxEntity.findOne({
                    where: { id: boxId },
                }),
            ]);
            if (!grab) {
                throw new Error(`GrabMysteryBoxEntity with id ${grabId} not found`);
            }
            if (!box) {
                throw new Error(`MysteryBoxEntity with id ${boxId} not found`);
            }
            if (grab.boxId !== box.id) {
                throw new Error(`GrabMysteryBoxEntity with id ${grabId} boxId is not match ${boxId}`);
            }
            const slotIndex = slot.transactions.findIndex((tx) => tx.transaction.signatures[0] === encode(txSig));
            if (slotIndex === -1) {
                throw new Error(`GrabMysteryBoxEntity with id ${grabId} slotIndex not found`);
            }
            switch (grab.status) {
                case GrabTransactionStatus.INIT:
                case GrabTransactionStatus.PENDING: {
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    try {
                        await queryRunner.startTransaction();
                        const manager = queryRunner.manager;
                        await manager.update(TransactionEntity, { id: grab.transactionId }, {
                            status: TransactionStatus.Success,
                            txSig,
                            slot: slotId,
                            slotIndex: BigInt(slotIndex),
                            updatedAt: new Date(),
                        });
                        grab.status = GrabTransactionStatus.CONFIRMED;
                        grab.updatedAt = new Date();
                        grab = await manager.save(grab);
                        box = await manager.findOne(MysteryBoxEntity, {
                            where: { id: boxId },
                            lock: {
                                mode: 'pessimistic_write',
                            },
                        });
                        if (!box) {
                            throw new Error(`MysteryBoxEntity ${boxId} not found`);
                        }
                        box.openCount += 1n;
                        if (box.openCount < box.openLimit &&
                            box.status === MysteryBoxStatus.GRABBING) {
                            box.status = MysteryBoxStatus.GRAB_ENDED;
                        }
                        box.updatedAt = new Date();
                        box = await manager.save(box);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw new Error(`[successGrabMysteryBox] Failed to update grab mystery box status: ${(error as Error).message}`);
                    }
                    finally {
                        await queryRunner.release();
                    }
                    break;
                }
                case GrabTransactionStatus.FAILED: {
                    throw new Error(`GrabMysteryBoxEntity with id ${grab.id} status is FAILED`);
                }
                default: {
                    break;
                }
            }
            if (!box) {
                throw new Error(`MysteryBoxEntity ${boxId} not found after update`);
            }
            return { grab, box };
        }
    async failGrabMysteryBox(grabId: bigint, errorReason: string, txSig: Buffer | null): Promise<{
        grab: GrabMysteryBoxEntity;
    }> {
            let grab = await this.grabMysteryBoxEntity.findOne({
                where: { id: grabId },
            });
            if (!grab) {
                throw new Error(`GrabMysteryBoxEntity with id ${grabId} not found`);
            }
            switch (grab.status) {
                case GrabTransactionStatus.INIT:
                case GrabTransactionStatus.PENDING: {
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    try {
                        await queryRunner.startTransaction();
                        const manager = queryRunner.manager;
                        await manager.update(TransactionEntity, { id: grab.transactionId }, {
                            status: TransactionStatus.Failed,
                            errorReason,
                            txSig,
                            updatedAt: new Date(),
                        });
                        grab.status = GrabTransactionStatus.FAILED;
                        grab.updatedAt = new Date();
                        grab = await manager.save(grab);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw new Error(`[failGrabMysteryBox] Failed to update grab mystery box status: ${(error as Error).message}`);
                    }
                    finally {
                        await queryRunner.release();
                    }
                    break;
                }
                case GrabTransactionStatus.FAILED: {
                    break;
                }
                default: {
                    throw new Error(`GrabMysteryBoxEntity with id ${grabId} status is ${grab.status}`);
                }
            }
            return { grab };
        }
    async successDistributeMysteryBox(boxId: bigint, bonusGrabIds: bigint[], refundGrabIds: bigint[], txSig: Buffer): Promise<{
        box: MysteryBoxEntity;
    }> {
            let box = await this.mysteryBoxEntity.findOne({
                where: { id: boxId },
            });
            if (!box) {
                throw new Error(`MysteryBoxEntity with id ${boxId} not found`);
            }
            switch (box.status) {
                case MysteryBoxStatus.DISTRIBUTE_INIT:
                case MysteryBoxStatus.DISTRIBUTE_PENDING: {
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    try {
                        await queryRunner.startTransaction();
                        const manager = queryRunner.manager;
                        await manager.update(TransactionEntity, { id: box.lotteryDrawTransactionId }, { status: TransactionStatus.Success, txSig, updatedAt: new Date() });
                        await manager.update(GrabMysteryBoxEntity, { id: In(bonusGrabIds) }, {
                            status: GrabTransactionStatus.DISTRIBUTE_CONFIRMED,
                            updatedAt: new Date(),
                        });
                        await manager.update(GrabMysteryBoxEntity, { id: In(refundGrabIds) }, {
                            status: GrabTransactionStatus.REFUND_CONFIRMED,
                            updatedAt: new Date(),
                        });
                        box.status = MysteryBoxStatus.DISTRIBUTE_CONFIRMED;
                        box.updatedAt = new Date();
                        box = await manager.save(box);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw new Error(`[successDistributeMysteryBox] Failed to update mystery box status: ${(error as Error).message}`);
                    }
                    finally {
                        await queryRunner.release();
                    }
                    break;
                }
                case MysteryBoxStatus.DISTRIBUTE_CONFIRMED: {
                    break;
                }
                default: {
                    throw new Error(`MysteryBoxEntity with id ${boxId} status is ${box.status}`);
                }
            }
            return { box };
        }
    /**
     * BUG-M3 (HIGH) fix: mark a distribute transaction as failed and
     * move the box to DISTRIBUTE_FAILED. This path is entered by the
     * watcher when a Solana tx's blockhash expires (txBlockHeight + 200
     * < current blockHeight). Without it the box stays in
     * DISTRIBUTE_PENDING forever and user funds are locked.
     *
     * We transition grab rows in DISTRIBUTE_* intermediate states to
     * their *_FAILED counterparts so the state is self-consistent; a
     * follow-up refund flow (manual or cron) can then settle funds.
     */
    async failDistributeMysteryBox(boxId: bigint, errorReason: string, txSig: Buffer | null): Promise<{
        box: MysteryBoxEntity;
    }> {
            let box = await this.mysteryBoxEntity.findOne({
                where: { id: boxId },
            });
            if (!box) {
                throw new Error(`MysteryBoxEntity with id ${boxId} not found`);
            }
            switch (box.status) {
                case MysteryBoxStatus.DISTRIBUTE_INIT:
                case MysteryBoxStatus.DISTRIBUTE_PENDING: {
                    const queryRunner = this.dataSource.createQueryRunner();
                    await queryRunner.connect();
                    try {
                        await queryRunner.startTransaction();
                        const manager = queryRunner.manager;
                        await manager.update(TransactionEntity, { id: box.lotteryDrawTransactionId }, {
                            status: TransactionStatus.Failed,
                            errorReason,
                            txSig,
                            updatedAt: new Date(),
                        });
                        // Move any grabs in an intermediate distribute
                        // state to their respective failed states so the
                        // row is self-consistent for downstream refund
                        // tooling.
                        await manager.update(
                            GrabMysteryBoxEntity,
                            {
                                lotteryDrawTransactionId: box.lotteryDrawTransactionId,
                                status: In([
                                    GrabTransactionStatus.DISTRIBUTE_INIT,
                                    GrabTransactionStatus.DISTRIBUTE_PENDING,
                                ]),
                            },
                            {
                                status: GrabTransactionStatus.DISTRIBUTE_FAILED,
                                updatedAt: new Date(),
                            },
                        );
                        await manager.update(
                            GrabMysteryBoxEntity,
                            {
                                lotteryDrawTransactionId: box.lotteryDrawTransactionId,
                                status: In([
                                    GrabTransactionStatus.REFUND_INIT,
                                    GrabTransactionStatus.REFUND_PENDING,
                                ]),
                            },
                            {
                                status: GrabTransactionStatus.REFUND_FAILED,
                                updatedAt: new Date(),
                            },
                        );
                        box.status = MysteryBoxStatus.DISTRIBUTE_FAILED;
                        box.updatedAt = new Date();
                        box = await manager.save(box);
                        await queryRunner.commitTransaction();
                    }
                    catch (error) {
                        await queryRunner.rollbackTransaction();
                        throw new Error(`[failDistributeMysteryBox] Failed to update mystery box status: ${(error as Error).message}`);
                    }
                    finally {
                        await queryRunner.release();
                    }
                    break;
                }
                case MysteryBoxStatus.DISTRIBUTE_FAILED:
                case MysteryBoxStatus.DISTRIBUTE_CONFIRMED: {
                    break;
                }
                default: {
                    throw new Error(`MysteryBoxEntity with id ${boxId} status is ${box.status}`);
                }
            }
            return { box };
        }
    async generateGrabMysteryBox(tx: Transaction, garbMysteryBox: GrabMysteryBoxEntity): Promise<{
        box: GrabMysteryBoxEntity;
        tx: TransactionEntity;
    }> {
            const { tx: solanaTx, recentBlockHeight } = tx;
            let transaction = new TransactionEntity();
            transaction.createdAt = new Date();
            transaction.updatedAt = new Date();
            transaction.txBody = Buffer.from(solanaTx.serialize());
            transaction.txOrderId = garbMysteryBox.id;
            transaction.txBlockHeight = BigInt(recentBlockHeight);
            transaction.status = TransactionStatus.Pending;
            transaction.txOrderType = TransactionType.GrabMysteryBox;
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            const manager = queryRunner.manager;
            try {
                transaction = await manager.save(transaction);
                garbMysteryBox.transactionId = transaction.id;
                transaction.updatedAt = new Date();
                garbMysteryBox = await manager.save(garbMysteryBox);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[generateGrabMysteryBox] error ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return { box: garbMysteryBox, tx: transaction };
        }
    async distributeMysteryBox(lotteryDrawResults: ILotteryDrawResults, tx: Transaction): Promise<void> {
            const boxId = lotteryDrawResults.creator.id;
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            const { tx: solanaTx, recentBlockHeight } = tx;
            try {
                const manager = queryRunner.manager;
                const mysteryBox = await manager.findOne(MysteryBoxEntity, {
                    where: { id: boxId, status: MysteryBoxStatus.GRABBING },
                    relations: { grabMysteryBoxs: true },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                if (!mysteryBox) {
                    throw new Error(`MysteryBoxEntity with id ${boxId} status ${MysteryBoxStatus.GRABBING} not found`);
                }
                let transaction = new TransactionEntity();
                transaction.createdAt = new Date();
                transaction.updatedAt = new Date();
                transaction.txBody = Buffer.from(solanaTx.serialize());
                transaction.txOrderId = BigInt(boxId);
                transaction.txBlockHeight = BigInt(recentBlockHeight);
                transaction.status = TransactionStatus.Pending;
                transaction.txOrderType = TransactionType.DistributeMysteryBox;
                transaction = await manager.save(transaction);
                await manager.update(MysteryBoxEntity, { id: boxId }, {
                    lotteryDrawAmount: lotteryDrawResults.creator.amount,
                    lotteryDrawTransactionId: transaction.id,
                    status: MysteryBoxStatus.DISTRIBUTE_INIT,
                    updatedAt: new Date(),
                });
                const updatePromises = mysteryBox.grabMysteryBoxs.map(async (grab) => {
                    const result = lotteryDrawResults.grabs.find((r) => r.id === grab.id);
                    if (result) {
                        await manager.update(GrabMysteryBoxEntity, { id: result.id }, {
                            lotteryDrawAmount: result.amount,
                            lotteryDrawTransactionId: transaction.id,
                            isBomb: result.isBomb,
                            status: result.type === 'bonus'
                                ? GrabTransactionStatus.DISTRIBUTE_INIT
                                : GrabTransactionStatus.REFUND_INIT,
                            updatedAt: new Date(),
                        });
                    }
                });
                await Promise.all(updatePromises);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
                throw new Error(`[initDistributeMysteryBox] Failed to update mystery box status: ${(error as Error).message}`);
            }
            finally {
                await queryRunner.release();
            }
        }
}
