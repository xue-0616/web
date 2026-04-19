import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginRecordsEntity } from '../../entities';
import moment from 'moment';

@Injectable()
export class LoginRecordsDBService {
    constructor(logger: any, @InjectRepository(LoginRecordsEntity) loginRecordsRepository: any) {
        this.logger = logger;
        this.loginRecordsRepository = loginRecordsRepository;
        this.logger.setContext(LoginRecordsDBService.name);
    }
    logger: any;
    loginRecordsRepository: any;
    async findOne(where: any) {
            const data = await this.loginRecordsRepository.findOne({ where });
            return data;
        }
    async updateDB(id: any, update: any) {
            await this.loginRecordsRepository.update(id, update);
        }
    async insertDB(accountId: any) {
            const date = moment().format('YYYYMMDD');
            const data = await this.findOne({ accountId, date });
            if (data) {
                const times = data.times + 1;
                const update = {
                    times,
                    updatedAt: new Date(),
                };
                await this.updateDB(data.id, update);
                return;
            }
            const entity = new LoginRecordsEntity();
            entity.accountId = accountId;
            entity.date = date;
            entity.times = 1;
            entity.createdAt = new Date();
            entity.updatedAt = new Date();
            try {
                await this.loginRecordsRepository.insert(entity);
            }
            catch (error) {
                this.logger.warn(`[insertDB] ${error}, entry = ${JSON.stringify(entity)}`);
            }
        }
}
