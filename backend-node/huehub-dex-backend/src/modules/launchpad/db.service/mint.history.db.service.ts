import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IssueStatus, MintHistoryEntity } from '../../../database/entities/mint.history.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { DataSource, EntityManager, FindOptionsRelations, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { MintInputDto } from '../dto/mint.token.input.dto';
import { WhitelistEntity } from '../../../database/entities/whitelist.entity';
import { LaunchpadRoundEntity, RoundType } from '../../../database/entities/launchpad.rounds.entity';
import { WhitelistDbService } from './whitelist.db.service';
import { LaunchpadRoundsDbService } from './launchpad.rounds.db.service';
import Decimal from 'decimal.js';
import { StatusName } from '../../../common/utils/error.code';

@Injectable()
export class MintHistotyDbService {
    constructor(private readonly logger: AppLoggerService, private readonly whitelistDbService: WhitelistDbService, readonly dataSource: DataSource, @InjectRepository(MintHistoryEntity) private mintHistotyRepository: Repository<MintHistoryEntity>, private launchpadRoundsDbService: LaunchpadRoundsDbService) {
        this.logger.setContext(MintHistotyDbService.name);
    }
    async findOne(where: FindOptionsWhere<MintHistoryEntity>, relations: FindOptionsRelations<MintHistoryEntity>): Promise<MintHistoryEntity> {
            return await this.mintHistotyRepository.findOne({ where, relations });
        }
    async find(where: FindOptionsWhere<MintHistoryEntity>, take: number = 100): Promise<MintHistoryEntity[]> {
            return await this.mintHistotyRepository.find({ where, take });
        }
    async count(where: FindOptionsWhere<MintHistoryEntity>): Promise<number> {
            return await this.mintHistotyRepository.count({ where });
        }
    async initMintByTransaction(input: MintInputDto, address: string, txId: string, roundEntityId: number, paymasterAddress: string, serviceFeeAmount: number): Promise<MintHistoryEntity> {
            let entity;
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let roundEntity = await manager.findOne(LaunchpadRoundEntity, {
                    where: {
                        id: roundEntityId,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                if (roundEntity.mintedAmount.greaterThanOrEqualTo(roundEntity.roundSupply)) {
                    this.logger.error('[initMintByTransaction] mintedAmount out of range');
                    throw new BadRequestException(StatusName.ParameterException);
                }
                let mintCount = roundEntity.addressMintLimit;
                let addressMintCount = await manager.count(MintHistoryEntity, {
                    where: {
                        launchpadTokenId: input.id,
                        launchpadRoundId: input.roundId,
                        status: Not(In([[IssueStatus.IssueFailed, IssueStatus.MintFailed]])),
                        address,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                if (addressMintCount >= mintCount) {
                    this.logger.error('[initMintByTransaction] mint out of range');
                    throw new BadRequestException(StatusName.ParameterException);
                }
                let historyEntity = await manager.findOne(MintHistoryEntity, {
                    where: {
                        btcTxHash: txId,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                if (historyEntity) {
                    this.logger.error('[initMintByTransaction] mint history data exist');
                    throw new BadRequestException(StatusName.ParameterException);
                }
                historyEntity = new MintHistoryEntity();
                historyEntity.address = address;
                historyEntity.btcTx = input.mintBtcTx;
                historyEntity.btcTxHash = txId;
                historyEntity.launchpadTokenId = input.id;
                historyEntity.launchpadRoundId = input.roundId;
                historyEntity.paymasterAddress = paymasterAddress;
                historyEntity.serviceFeeAmount = new Decimal(serviceFeeAmount);
                historyEntity.status = IssueStatus.MintInit;
                historyEntity.createdAt = new Date();
                historyEntity.updatedAt = new Date();
                let whitelistEntity;
                ({ roundEntity, whitelistEntity } = await this.setLaunchpadMintStatus(roundEntity, historyEntity, manager));
                await manager.save(historyEntity);
                await manager.save(roundEntity);
                if (whitelistEntity) {
                    await manager.save(whitelistEntity);
                }
                await queryRunner.commitTransaction();
                entity = historyEntity;
            }
            catch (error) {
                this.logger.error(`[initMintByTransaction] ${error?.stack}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
            return entity;
        }
    async setLaunchpadMintStatus(roundEntity: LaunchpadRoundEntity, historyEntity: MintHistoryEntity, manager: EntityManager): Promise<{
        roundEntity: LaunchpadRoundEntity;
        whitelistEntity?: WhitelistEntity;
    }> {
            let whitelistEntity;
            if (roundEntity.roundType !== RoundType.PublicMint) {
                whitelistEntity = await manager.findOne(WhitelistEntity, {
                    where: {
                        address: historyEntity.address,
                        launchpadTokenId: historyEntity.launchpadTokenId,
                        launchpadRoundId: historyEntity.launchpadRoundId,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                if (!whitelistEntity) {
                    this.logger.error(`[setLaunchpadMintStatus] whitelistEntity not find ${JSON.stringify({
                        address: historyEntity.address,
                        launchpadTokenId: historyEntity.launchpadTokenId,
                        launchpadRoundId: historyEntity.launchpadRoundId,
                    })}`);
                    throw new BadRequestException(StatusName.ParameterException);
                }
            }
            if (whitelistEntity) {
                ({ roundEntity, whitelistEntity } = this.setWhitelistMintStatus(whitelistEntity, roundEntity, historyEntity.status));
            }
            else {
                roundEntity = this.setNotWhitelistMintStatus(roundEntity, historyEntity.status);
            }
            return { roundEntity, whitelistEntity };
        }
    async updateLaunchpadMintStatus(historyEntity: MintHistoryEntity): Promise<void> {
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                let roundEntity = await manager.findOne(LaunchpadRoundEntity, {
                    where: {
                        id: historyEntity.launchpadRoundId,
                    },
                    lock: {
                        mode: 'pessimistic_write',
                    },
                });
                if (historyEntity.status == IssueStatus.MintFailed) {
                    let { roundEntity: updateRoundEntity, whitelistEntity } = await this.setLaunchpadMintStatus(roundEntity, historyEntity, manager);
                    await manager.save(updateRoundEntity);
                    await manager.save(whitelistEntity);
                }
                await manager.save(historyEntity);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[updateMintHistory] ${error?.stack}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
    setWhitelistMintStatus(whitelistEntity: WhitelistEntity, roundEntity: LaunchpadRoundEntity, status: IssueStatus): {
        whitelistEntity: WhitelistEntity;
        roundEntity: LaunchpadRoundEntity;
    } {
            if (status === IssueStatus.MintFailed) {
                whitelistEntity.mintCount = whitelistEntity.mintCount - 1;
                whitelistEntity.claimed = false;
                roundEntity.mintedAmount = roundEntity.mintedAmount.minus(whitelistEntity.amountPerMint);
                if (roundEntity.mintedAmount.greaterThanOrEqualTo(roundEntity.roundSupply)) {
                    this.logger.error('[setWhitelistMintStatus] mintedAmount out of range');
                    throw new BadRequestException(StatusName.ParameterException);
                }
            }
            if (status === IssueStatus.MintInit) {
                whitelistEntity.mintCount = whitelistEntity.mintCount + 1;
                if (whitelistEntity.mintCount === roundEntity.addressMintLimit) {
                    whitelistEntity.claimed = true;
                }
                roundEntity.mintedAmount = roundEntity.mintedAmount.add(whitelistEntity.amountPerMint);
            }
            whitelistEntity.updatedAt = new Date();
            roundEntity.updatedAt = new Date();
            return { whitelistEntity, roundEntity };
        }
    setNotWhitelistMintStatus(roundEntity: LaunchpadRoundEntity, status: IssueStatus): LaunchpadRoundEntity {
            if (status === IssueStatus.MintInit) {
                roundEntity.mintedAmount = roundEntity.mintedAmount.add(roundEntity.amountPerMint);
            }
            if (status === IssueStatus.MintFailed) {
                roundEntity.mintedAmount = roundEntity.mintedAmount.minus(roundEntity.amountPerMint);
            }
            if (roundEntity.mintedAmount.greaterThanOrEqualTo(roundEntity.roundSupply)) {
                this.logger.error('[setNotWhitelistMintStatus] mintedAmount out of range');
                throw new BadRequestException(StatusName.ParameterException);
            }
            roundEntity.updatedAt = new Date();
            return roundEntity;
        }
}
