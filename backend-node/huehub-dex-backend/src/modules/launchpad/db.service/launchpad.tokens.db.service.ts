import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LaunchpadTokenEntity } from '../../../database/entities/launchpad.tokens.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { DataSource, FindOptionsRelations, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class LaunchpadTokensDbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(LaunchpadTokenEntity) private launchpadTokenRepository: Repository<LaunchpadTokenEntity>) {
        this.logger.setContext(LaunchpadTokensDbService.name);
    }
    async find(where: FindOptionsWhere<LaunchpadTokenEntity>, relations?: FindOptionsRelations<LaunchpadTokenEntity>): Promise<LaunchpadTokenEntity[]> {
            return await this.launchpadTokenRepository.find({ where, relations });
        }
    async updateRounds(entities: LaunchpadTokenEntity[]): Promise<LaunchpadTokenEntity[]> {
            if (entities.length === 0) {
                return [];
            }
            return await this.launchpadTokenRepository.save(entities);
        }
}
