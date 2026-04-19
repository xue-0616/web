import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CkbBlockEntity, DobsEntity } from '../../database/entities';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { DobsStatistic } from '../../common/interface/statistic';

@Injectable()
export class IndexerDbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(DobsEntity) private readonly dobsRepository: Repository<DobsEntity>, @InjectRepository(CkbBlockEntity) private readonly blockRepository: Repository<CkbBlockEntity>) {
        this.logger.setContext(IndexerDbService.name);
    }
    async curCkbBlock(): Promise<CkbBlockEntity | null> {
            const curCkbBlock = await this.blockRepository.findOne({
                where: {},
            });
            return curCkbBlock;
        }
    async updateCkbBlockEntity(blockEntity: CkbBlockEntity): Promise<void> {
            await this.blockRepository.save(blockEntity);
        }
    async updateDobsEntity(dobsEntity: DobsEntity): Promise<void> {
            await this.dobsRepository.save(dobsEntity);
        }
    async findOneDobsEntity(where: FindOptionsWhere<DobsEntity>): Promise<DobsEntity | null> {
            return await this.dobsRepository.findOne({ where });
        }
    async insertOrUpdateDosCell(entities: DobsEntity[], curBlockNumber: number): Promise<void> {
            const queryRunner = this.dataSource.createQueryRunner();
            try {
                await queryRunner.connect();
                await queryRunner.startTransaction();
                const manager = queryRunner.manager;
                if (entities.length > 0) {
                    await manager.save(entities);
                }
                let blockEntity = await manager.findOne(CkbBlockEntity, { where: {} });
                if (!blockEntity) {
                    blockEntity = new CkbBlockEntity();
                    blockEntity.createdAt = new Date();
                    blockEntity.updatedAt = new Date();
                    blockEntity.curBlockNumber = curBlockNumber;
                }
                else {
                    blockEntity.curBlockNumber = curBlockNumber;
                    blockEntity.updatedAt = new Date();
                }
                await manager.save(blockEntity);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                this.logger.error(`[insertOrUpdateDosCell] ${(error as Error)?.stack}`);
                await queryRunner.rollbackTransaction();
            }
            finally {
                await queryRunner.release();
            }
        }
    async queryDobsEntity(where: FindOptionsWhere<DobsEntity>[], take: number): Promise<DobsEntity[]> {
            return await this.dobsRepository.find({ where, take });
        }
    async cellCount(where: FindOptionsWhere<DobsEntity>): Promise<number> {
            return await this.dobsRepository.count({ where });
        }
    async findAndCount(where: FindOptionsWhere<DobsEntity>): Promise<[DobsEntity[], number]> {
            return await this.dobsRepository.findAndCount({ where });
        }
    async getAddressDobs(where: FindOptionsWhere<DobsEntity>): Promise<Record<string, DobsEntity[]>> {
            const dobEntities = await this.dobsRepository.find({ where });
            const grouped = dobEntities.reduce((acc: Record<string, DobsEntity[]>, dob) => {
                const key = dob.clusterTypeArgs;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(dob);
                return acc;
            }, {});
            return grouped;
        }
    async queryHoldersAndTotalSupply(clusterTypeArgs: string): Promise<DobsStatistic> {
            const result = await this.dobsRepository.query(`
          SELECT COUNT(DISTINCT btc_address) AS holders, COUNT(type_args) AS totalSupply 
          FROM dobs 
           WHERE cluster_type_args = x'${clusterTypeArgs.replace('0x', '')}'
        `);
            return result[0];
        }
}
