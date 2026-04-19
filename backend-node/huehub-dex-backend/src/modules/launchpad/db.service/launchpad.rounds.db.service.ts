import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LaunchpadRoundEntity } from '../../../database/entities/launchpad.rounds.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class LaunchpadRoundsDbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(LaunchpadRoundEntity) private launchpadRoundRepository: Repository<LaunchpadRoundEntity>) {
        this.logger.setContext(LaunchpadRoundsDbService.name);
    }
    async findOne(where: FindOptionsWhere<LaunchpadRoundEntity>): Promise<LaunchpadRoundEntity> {
            return await this.launchpadRoundRepository.findOne({ where });
        }
    async find(where: FindOptionsWhere<LaunchpadRoundEntity>): Promise<LaunchpadRoundEntity[]> {
            return await this.launchpadRoundRepository.find({ where });
        }
    async updateRounds(entities: LaunchpadRoundEntity[]): Promise<LaunchpadRoundEntity[]> {
            if (entities.length === 0) {
                return [];
            }
            return await this.launchpadRoundRepository.save(entities);
        }
}
