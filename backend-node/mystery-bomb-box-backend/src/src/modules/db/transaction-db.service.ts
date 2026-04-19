import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionEntity } from '../../database/entities/transaction.entity';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class TransactionDbService {
    constructor(private readonly logger: AppLoggerService, @InjectRepository(TransactionEntity) private transactionRepository: Repository<TransactionEntity>) {
        this.logger.setContext(TransactionDbService.name);
    }
    async find(where: FindOptionsWhere<TransactionEntity>, order?: FindOptionsOrder<TransactionEntity>, take?: number): Promise<TransactionEntity[]> {
            return await this.transactionRepository.find({ where, take, order });
        }
    async update(entity: TransactionEntity): Promise<TransactionEntity> {
            return await this.transactionRepository.save(entity);
        }
}
