import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IApRelayerStatus, IApTransactionStatus, UserActionPointEntity, UserActionPointHistoryEntity, UserActionPointRelayerEntity, UserActionPointStatus, UserActionPointTransactionsEntity } from '../entities';
// ethers v6: BigNumber removed — use native BigInt
import { BigIntValue, handleWarnError } from '../../../shared/utils/ap.utils';
import { StatusName } from '../../../shared/utils';

@Injectable()
export class ActionPointTransactionsService {
    constructor(logger: any, @InjectRepository(UserActionPointRelayerEntity) relayerRepository: any, @InjectRepository(UserActionPointTransactionsEntity) transactionsRepository: any, @InjectRepository(UserActionPointHistoryEntity) historyRepository: any, @InjectRepository(UserActionPointEntity) actionPointRepository: any, connection: any) {
        this.logger = logger;
        this.relayerRepository = relayerRepository;
        this.transactionsRepository = transactionsRepository;
        this.historyRepository = historyRepository;
        this.actionPointRepository = actionPointRepository;
        this.connection = connection;
        logger.setContext(ActionPointTransactionsService.name);
    }
    logger: any;
    relayerRepository: any;
    transactionsRepository: any;
    historyRepository: any;
    actionPointRepository: any;
    connection: any;
    async deductActionPoint(relayerTxHash: any, chainTxHash: any) {
            const queryRunner = this.connection.createQueryRunner();
            let isDeduct = false;
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const transactionDb = (await manager.findOne(UserActionPointTransactionsEntity, {
                    where: {
                        relayerTxHash,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                }));
                const { historyId, accountId, actionPoint, transaction } = transactionDb;
                const historyDb = (await manager.findOne(UserActionPointHistoryEntity, {
                    where: { id: historyId },
                    lock: { mode: 'pessimistic_write' },
                }));
                const actionPointDb = (await manager.findOne(UserActionPointEntity, {
                    where: { accountId: `${accountId} ` },
                    lock: { mode: 'pessimistic_write' },
                }));
                transactionDb.status = IApTransactionStatus.COMPLETE;
                transactionDb.chainTxHash = chainTxHash;
                transactionDb.updatedAt = new Date();
                transactionDb.transaction = JSON.stringify(JSON.parse(JSON.stringify(transaction)));
                await manager.save(transactionDb);
                historyDb.status = UserActionPointStatus.SUCCESS;
                historyDb.changeTime = new Date();
                historyDb.updatedAt = new Date();
                await manager.save(historyDb);
                actionPointDb.availActionPoint = (BigInt(actionPointDb.availActionPoint) - BigInt(actionPoint)).toString();
                actionPointDb.lockActionPoint = (BigInt(actionPointDb.lockActionPoint) - BigInt(actionPoint)).toString();
                actionPointDb.updatedAt = new Date();
                await manager.save(actionPointDb);
                await queryRunner.commitTransaction();
                isDeduct = true;
            }
            catch (error) {
                handleWarnError('deductActionPoint', error, this.logger);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return isDeduct;
        }
    async reversalDeductActionPoint(relayerTxHash: any) {
            let isReversal = false;
            const queryRunner = this.connection.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const transactionDb = (await manager.findOne(UserActionPointTransactionsEntity, {
                    where: {
                        relayerTxHash,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                }));
                const { historyId, accountId, actionPoint, transaction } = transactionDb;
                const historyDb = (await manager.findOne(UserActionPointHistoryEntity, {
                    where: { id: historyId },
                    lock: { mode: 'pessimistic_write' },
                }));
                const actionPointDb = (await manager.findOne(UserActionPointEntity, {
                    where: { accountId: `${accountId}` },
                    lock: { mode: 'pessimistic_write' },
                }));
                transactionDb.status = IApTransactionStatus.FAIL;
                transactionDb.updatedAt = new Date();
                transactionDb.transaction = JSON.stringify(JSON.parse(JSON.stringify(transaction)));
                await manager.save(transactionDb);
                historyDb.status = UserActionPointStatus.FAIL;
                historyDb.updatedAt = new Date();
                await manager.save(historyDb);
                actionPointDb.lockActionPoint = (BigInt(actionPointDb.lockActionPoint) - BigInt(actionPoint)).toString();
                actionPointDb.updatedAt = new Date();
                await manager.save(actionPointDb);
                await queryRunner.commitTransaction();
                isReversal = true;
            }
            catch (error) {
                handleWarnError('reversalDeductActionPoint', error, this.logger);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return isReversal;
        }
    async LockActionPoint(relayerId: any, accountId: any, historyData: any, transactionData: any) {
            const queryRunner = this.connection.createQueryRunner();
            let isLock = false;
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                transactionData.relayerId = relayerId;
                const historyDb = await this.insertHistoryToDB(historyData, manager);
                transactionData.historyId = historyDb === null || historyDb === void 0 ? void 0 : historyDb.id;
                await this.insertTransactionToDB(transactionData, manager);
                const actionPoint = (await manager.findOne(UserActionPointEntity, {
                    where: { accountId: `${accountId}` },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                }));
                this.checkActionPointValueIsValid(transactionData.actionPoint, actionPoint);
                actionPoint.lockActionPoint = (BigInt(actionPoint.lockActionPoint) + BigInt(transactionData.actionPoint)).toString();
                actionPoint.updatedAt = new Date();
                await manager.save(actionPoint);
                await queryRunner.commitTransaction();
                isLock = true;
            }
            catch (error) {
                handleWarnError('LockActionPoint', error, this.logger);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return isLock;
        }
    async distributeActionPoint(historyData: any, actionPointData: any) {
            const queryRunner = this.connection.createQueryRunner();
            let apDbInfo;
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                await this.insertHistoryToDB(historyData, manager);
                apDbInfo = await manager.findOne(UserActionPointEntity, {
                    where: { accountId: `${actionPointData.accountId}` },
                    lock: { mode: 'pessimistic_write' },
                });
                if (apDbInfo) {
                    const availActionPoint = (BigInt(apDbInfo.availActionPoint) + BigInt(actionPointData.availActionPoint)).toString();
                    if (BigInt(availActionPoint) > BigInt(BigIntValue.maxValueUnsigned)) {
                        this.logger.warn(`[distributeActionPoint] availActionPoint overflow ${availActionPoint}`);
                        apDbInfo = undefined;
                    }
                    else {
                        apDbInfo.availActionPoint = availActionPoint;
                        apDbInfo.updatedAt = new Date();
                        apDbInfo = await manager.save(apDbInfo);
                    }
                }
                else {
                    apDbInfo = await this.insertActionPointToDB(actionPointData, manager);
                }
                await queryRunner.commitTransaction();
            }
            catch (error) {
                handleWarnError('distributeActionPoint', error, this.logger);
                await queryRunner.rollbackTransaction();
                apDbInfo = undefined;
            }
            finally {
                await queryRunner.release();
            }
            return apDbInfo;
        }
    async insertDataToApRelayerDB(relayerAuthAddr: any, relayerUrl: any) {
            const queryRunner = this.connection.createQueryRunner();
            this.logger.log(`[insertDataToApRelayerDB] start insert ${relayerUrl}`);
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                const dbInfo = await manager.findOne(UserActionPointRelayerEntity, {
                    where: { relayerAuthAddr },
                    lock: { mode: 'pessimistic_write' },
                });
                if (dbInfo) {
                    this.logger.log(`insertDataToApRelayerDB ${relayerAuthAddr} is exist`);
                    if (dbInfo.status !== IApRelayerStatus.OPEN) {
                        dbInfo.status = IApRelayerStatus.OPEN;
                        dbInfo.updatedAt = new Date();
                        await manager.save(dbInfo);
                    }
                }
                else {
                    const entity = new UserActionPointRelayerEntity();
                    entity.relayerAuthAddr = relayerAuthAddr;
                    entity.relayerUrl = relayerUrl;
                    entity.status = IApRelayerStatus.OPEN;
                    entity.createdAt = new Date();
                    entity.updatedAt = new Date();
                    await (manager === null || manager === void 0 ? void 0 : manager.save(entity));
                }
                this.logger.log(`[insertDataToApRelayerDB] insert ${relayerUrl}`);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.warn(`insertDataToApRelayerDB find error ${error}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
    async insertHistoryToDB(data: any, manager: any) {
            const entity = new UserActionPointHistoryEntity();
            entity.accountId = data.accountId;
            entity.actionPointDiff = data.actionPointDiff;
            entity.changeType = data.changeType;
            entity.status = data.status ? data.status : UserActionPointStatus.PENDING;
            entity.changeTime = data.changeTime ? data.changeTime : undefined;
            entity.changeMsg = data.changeMsg ? data.changeMsg : undefined;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            try {
                const dbData = await manager.save(entity);
                return dbData;
            }
            catch (error) {
                handleWarnError('insertHistoryToDB', error, this.logger);
            }
        }
    async insertActionPointToDB(data: any, manager: any) {
            const entity = new UserActionPointEntity();
            entity.accountId = data.accountId;
            entity.availActionPoint = data.availActionPoint;
            entity.decimal = data.decimal ? data.decimal : 0;
            entity.lockActionPoint = data.lockActionPoint ? data.lockActionPoint : '0';
            entity.discount = data.discount ? data.discount : 100;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            try {
                const dbData = await manager.save(entity);
                return dbData;
            }
            catch (error) {
                handleWarnError('insertActionPointToDB', error, this.logger);
            }
        }
    async insertTransactionToDB(data: any, manager: any) {
            const entity = new UserActionPointTransactionsEntity();
            entity.accountId = data.accountId;
            entity.relayerId = data.relayerId;
            entity.historyId = data.historyId;
            entity.transaction = data.transaction;
            entity.actionPoint = data.actionPoint;
            entity.relayerTxHash = data.relayerTxHash;
            entity.status = IApTransactionStatus.PENDING;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            const dbData = await manager.save(entity);
            return dbData;
        }
    async getRelayerDataByWhere(where: any) {
            const data = await this.relayerRepository.findOne({ where });
            return data;
        }
    async findTransactionDataByWhere(where: any) {
            const data = await this.transactionsRepository.findOne({
                where,
            });
            return data;
        }
    async findHistoryDataByWhere(where: any) {
            const data = await this.historyRepository.findOne({
                where,
            });
            return data;
        }
    async findHistoryListByWhere(where: any, take: any = 10, page: any = 1, select: any) {
            take = take < 0 ? 10 : take;
            page = page < 1 ? 0 : page - 1;
            select = select
                ? select
                : [
                    'accountId',
                    'actionPointDiff',
                    'changeType',
                    'status',
                    'changeTime',
                    'changeMsg',
                ];
            const query = {
                where,
                select,
                skip: page * take,
                take,
                order: {
                    changeTime: 'DESC',
                },
            };
            try {
                const [list, total] = await this.historyRepository.findAndCount(query);
                this.logger.log(`[findTransactionDataByWhere] = ${JSON.stringify(query)} data length = ${list.length}`);
                return { total, list };
            }
            catch (error) {
                handleWarnError('findTransactionDataByWhere', error, this.logger);
                return { total: 0, list: [] };
            }
        }
    async findActionPointByAccountId(accountId: any) {
            const actionPoint = await this.actionPointRepository.findOne({
                where: { accountId: `${accountId}` },
            });
            return actionPoint;
        }
    async findOneActionPointDbInfo(accountId: any) {
            const data = await this.actionPointRepository.findOne({
                where: { accountId: `${accountId}` },
                select: ['availActionPoint', 'discount', 'lockActionPoint', 'id'],
            });
            return data;
        }
    checkActionPointValueIsValid(ap: any, apInfo: any) {
            if (!apInfo) {
                throw new BadRequestException(StatusName.INSUFFICIENT_AP);
            }
            const { availActionPoint, lockActionPoint } = apInfo;
            if (BigInt(ap) > (BigInt(availActionPoint) - BigInt(lockActionPoint))) {
                this.logger.warn(`[getActionPointHistory] apInfo insufficient of ap ${JSON.stringify({
                    availActionPoint,
                    lockActionPoint,
                    ap,
                })} `);
                throw new BadRequestException(StatusName.INSUFFICIENT_AP);
            }
        }
}
