import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WhitelistEntity } from '../../../database/entities/whitelist.entity';
import { AppLoggerService } from '../../../common/utils-service/logger.service';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class WhitelistDbService {
    constructor(private readonly logger: AppLoggerService, readonly dataSource: DataSource, @InjectRepository(WhitelistEntity) private whitelistEntity: Repository<WhitelistEntity>) {
        this.logger.setContext(WhitelistDbService.name);
    }
    async findOne(where: FindOptionsWhere<WhitelistEntity>): Promise<WhitelistEntity> {
            return await this.whitelistEntity.findOne({ where });
        }
}
