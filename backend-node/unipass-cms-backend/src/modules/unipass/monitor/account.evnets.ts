import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { format } from 'date-fns';
// ethers v6: BigNumber removed — use native BigInt/Number
import { Repository } from 'typeorm';
import StatisticsEvent from '../../../entities/default/statistics/statistics-event.entity';
import { AccountsEntity } from '../../../entities/unipass/accounts.entity';
import { Topics } from '../../../modules/unipass/class/chain.class';
import { QueryAbiService } from '../../../modules/unipass/chain/query-abi.service';
import { IStatisticsEventsDetailsDto, IStatisticsEventsDto } from '../../../modules/unipass/dto/unipass.dto';
import { EventDbInfo } from '../../../modules/unipass/monitor/class';
import { StatisticsService } from '../../../modules/unipass/statistics.service';
import { RedisService } from '../../../shared/services/redis.service';

@Injectable()
export class AccountEventService {
    constructor(
        private readonly queryAbiService: QueryAbiService,
        private readonly redisService: RedisService,
        @InjectRepository(AccountsEntity, 'UniPass_db')
        private readonly accountRepository: Repository<AccountsEntity>,
        @InjectRepository(StatisticsEvent, 'default')
        private readonly statisticsEventRepository: Repository<StatisticsEvent>,
        private readonly statisticsService: StatisticsService,
    ) {}

    async getAccountInfoByAddress(address: string): Promise<AccountsEntity | null> {
        return this.accountRepository.findOne({
            where: { address },
            select: ['email', 'source'],
        });
    }

    async saveTxEventInfo(data: EventDbInfo): Promise<void> {
        const eventTx = await this.statisticsEventRepository.findOne({
            where: {
                transactionHash: data.transactionHash,
                email: data.email,
                topics: data.topics,
            },
        });
        if (eventTx) {
            return;
        }
        try {
            await this.statisticsEventRepository.insert(data as any);
        } catch (error) {
            console.error(error, data);
        }
    }

    async getLatestBlockNumber(topics: string): Promise<number> {
        const eventTx = await this.statisticsEventRepository.find({
            where: { topics },
            order: { blockNumber: 'desc' as any },
            take: 1,
        });
        if (eventTx.length === 0) {
            return 0;
        }
        return Number(eventTx[0].blockNumber) + 1;
    }

    async initEvent(keyName: string, topic: string): Promise<void> {
        const start = await this.getLatestBlockNumber(topic);
        const key = `${keyName}_${start}`;
        const dataList = await this.redisService.getRedis().get(key);
        const data = dataList ? JSON.parse(dataList) : await this.queryAbiService.getEventList(topic, `${start}`);
        for (const item of data) {
            item.blockNumber = String(BigInt(item.blockNumber));
            const timeStamp = format(new Date(Number(BigInt(item.timeStamp)) * 1000), 'yyyy-MM-dd HH:mm:ss');
            item.timeStamp = timeStamp;
            const accounts = await this.getAccountInfoByAddress(item.address);
            if (!accounts) {
                continue;
            }
            const statisticsEvent: EventDbInfo = {
                blockNumber: item.blockNumber,
                topics: item.topics[0],
                createdAt: new Date(timeStamp),
                updatedAt: new Date(),
                address: item.address,
                transactionHash: item.transactionHash,
                email: (accounts as any).email,
                source: (accounts as any).source,
            };
            await this.saveTxEventInfo(statisticsEvent);
        }
    }

    async initRecoveryEvent(): Promise<void> {
        try {
            await this.initEvent('getUpdateKeysethashWithTimeLock', Topics.updateRecoveryHashWithTimeLock);
        } catch (error) {
            console.error(error, 'initRecoveryEvent');
        }
    }

    async initCancleRecoveryEvent(): Promise<void> {
        try {
            await this.initEvent('CancleRecovery', Topics.cancleKeysetHash);
        } catch (error) {
            console.error(error, 'initCancleRecoveryEvent');
        }
    }

    async initCompleteRecoveryEvent(): Promise<void> {
        try {
            await this.initEvent('getCompleteRecovery', Topics.completeRecovey);
        } catch (error) {
            console.error(error, 'initCompleteRecoveryEvent');
        }
    }

    async initRegister(): Promise<void> {
        try {
            await this.initEvent('Register', Topics.setSource);
        } catch (error) {
            console.error(error, 'initRegister');
        }
    }

    async initUpdateKeysetHash(): Promise<void> {
        try {
            await this.initEvent('UpdateKeysetHash', Topics.updateKetsetHash);
        } catch (error) {
            console.error(error, 'initUpdateKeysetHash');
        }
    }

    async getEventList(dto: IStatisticsEventsDto): Promise<any> {
        const { topics } = dto as any;
        switch (topics) {
            case Topics.updateRecoveryHashWithTimeLock:
                await this.initRecoveryEvent();
                break;
            case Topics.completeRecovey:
                await this.initCompleteRecoveryEvent();
                break;
            case Topics.cancleKeysetHash:
                await this.initCancleRecoveryEvent();
                break;
            case Topics.updateKetsetHash:
                await this.initUpdateKeysetHash();
                break;
            case Topics.setSource:
            default:
                await this.initRegister();
                break;
        }
        return this.statisticsService.statisticsEvent(dto as any, topics);
    }

    async getEventDetailsList(dto: IStatisticsEventsDetailsDto): Promise<any> {
        try {
            return await this.statisticsService.statisticsDetailsEvent(dto as any);
        } catch (error: any) {
            console.error(`[getEventDetailsList] error ${(error as Error).message}`);
            return {
                list: [],
                pagination: {
                    total: 0,
                    size: 0,
                    page: 0,
                },
            };
        }
    }
}
