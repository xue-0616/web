import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateParamConfigDto, UpdateParamConfigDto } from './param-config.dto';
import SysConfig from '../../../../entities/default/admin/sys-config.entity';
import { ApiException } from '../../../../common/exceptions/api.exception';

@Injectable()
export class SysParamConfigService {
    constructor(
        @InjectRepository(SysConfig, 'default')
        private readonly configRepository: Repository<SysConfig>,
    ) {}

    async getConfigListByPage(page: number, count: number): Promise<SysConfig[]> {
        return this.configRepository.find({ order: { id: 'ASC' }, take: count, skip: page * count });
    }

    async countConfigList(): Promise<number> {
        return this.configRepository.count();
    }

    async add(dto: CreateParamConfigDto): Promise<void> {
        await this.configRepository.insert(dto as any);
    }

    async update(dto: UpdateParamConfigDto): Promise<void> {
        await this.configRepository.update({ id: dto.id }, { name: dto.name, value: dto.value, remark: dto.remark });
    }

    async delete(ids: number[]): Promise<void> {
        await this.configRepository.delete(ids);
    }

    async findOne(id: number): Promise<SysConfig> {
        return this.configRepository.findOne({ where: { id } }) as Promise<SysConfig>;
    }

    async isExistKey(key: string): Promise<void> {
        const result = await this.configRepository.findOne({ where: { key } });
        if (result) throw new ApiException(10021);
    }

    async findValueByKey(key: string): Promise<string | null> {
        const result = await this.configRepository.findOne({ where: { key }, select: ['value'] });
        return result ? result.value : null;
    }
}
