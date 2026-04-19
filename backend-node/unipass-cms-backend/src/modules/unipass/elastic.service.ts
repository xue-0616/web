import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Client } from '@elastic/elasticsearch';
import { addDays, differenceInDays, format } from 'date-fns';
import { Repository } from 'typeorm';
import { UserAuditInfo } from './class/unipass.class';
import { ApiConfigService } from '../../shared/services/api-config.service';
import StatisticsSign from '../../entities/default/statistics/statistics-sign.entity';
import { AccountsEntity } from '../../entities/unipass/accounts.entity';

const { Cron, CronExpression } = require('@nestjs/schedule');

@Injectable()
export class ElasticService {
    private client!: Client;

    constructor(
        private readonly apiConfigService: ApiConfigService,
        @InjectRepository(StatisticsSign, 'default')
        private readonly statisticsSignRepository: Repository<StatisticsSign>,
        @InjectRepository(AccountsEntity, 'UniPass_db')
        private readonly accountRepository: Repository<AccountsEntity>,
    ) {
        this.initClient();
    }

    initClient(): void {
        this.client = new Client({
            nodes: this.apiConfigService.getElasticConfig.nodes.split(','),
            requestTimeout: 60000,
            sniffOnStart: true,
            sniffOnConnectionFault: true,
            auth: {
                username: this.apiConfigService.getElasticConfig.username,
                password: this.apiConfigService.getElasticConfig.password,
            },
        });
    }

    async findLatestDbSingInfo(): Promise<Date | null> {
        try {
            const data = await this.statisticsSignRepository.findOne({
                where: {},
                order: { createdAt: 'desc' as any },
            });
            if (!data) {
                return null;
            }
            return data.createdAt;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    async saveStatisticsSignInfo(userAuditInfo: any): Promise<void> {
        const { email, provider, offset, timestamp, source } = userAuditInfo;
        const data = await this.statisticsSignRepository.findOne({
            where: { offset },
        });
        if (data) return;
        const statisticsSign: any = {
            email,
            provider,
            offset,
            source,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
        };
        try {
            await this.statisticsSignRepository.insert(statisticsSign);
        } catch (error) {
            console.error(error);
        }
    }

    async getTssSignLogs(start: string, end: string): Promise<UserAuditInfo[]> {
        try {
            const result = await this.client.search({
                index: this.apiConfigService.getElasticConfig.logIndex,
                sort: 'timestamp:desc',
                size: 8000,
                track_total_hits: false,
                body: {
                    _source: ['level', 'message', 'timestamp', 'log.offset'],
                    query: {
                        bool: {
                            filter: [
                                { match_phrase: { message: '^[startAudit] startSign email.*' } },
                                { range: { timestamp: { gte: start, lt: end } } },
                            ],
                        },
                    },
                },
            });
            return this.parseHitsLogs(result);
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async parseHitsLogs(data: any): Promise<UserAuditInfo[]> {
        const userAuditList = await this.getUserAuditList(data);
        const userMap = await this.getUserSourceList(userAuditList);
        for (const item of userAuditList) {
            const { email, provider, timestamp, offset } = item as any;
            const source = userMap.get(`${(item as any).email}_${(item as any).provider}`);
            await this.saveStatisticsSignInfo({ email, provider, timestamp, offset, source });
        }
        return userAuditList;
    }

    async getUserSourceList(data: any[]): Promise<Map<string, string>> {
        const userMap = new Map<string, string>();
        const where: any[] = [];
        for (const item of data) {
            const { email, provider } = item as any;
            if (!email) {
                continue;
            }
            const user = userMap.get(`${(item as any).email}_${(item as any).provider}`);
            if (!user) {
                where.push({ email, provider });
                userMap.set(`${(item as any).email}_${(item as any).provider}`, 'unipass');
            }
        }
        if (where.length === 0) {
            return userMap;
        }
        const users = await this.accountRepository.find({ where });
        for (const item of users) {
            userMap.set(`${(item as any).email}_${(item as any).provider}`, (item as any).source);
        }
        return userMap;
    }

    async getUserAuditList(data: any): Promise<UserAuditInfo[]> {
        const hits = (data as any).body?.hits?.hits || [];
        const userAuditList: any[] = [];
        for (const item of hits) {
            const timestamp = item._source.timestamp;
            const offset = item._source?.log?.offset;
            const { email, provider } = this.parseAuditUserInfo(item._source.message);
            if (!email) continue;
            userAuditList.push({ email, provider, timestamp, offset });
        }
        return userAuditList;
    }

    parseAuditUserInfo(message: string): { email: string; provider: number } {
        const messageInfo = message.split('email =');
        const userKey = { email: '', provider: 0 };
        if (messageInfo.length < 2) return userKey;
        const userInfo = messageInfo[1].split('msg =');
        if (userInfo.length < 2) return userKey;
        userKey.email = userInfo[0].slice(0, userInfo[0].length - 3).trim();
        userKey.provider = Number(userInfo[0].slice(userInfo[0].length - 2, userInfo[0].length).trim());
        return userKey;
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async initAuditInfo(): Promise<void> {
        let timeStart = '2022-11-15';
        const timeEnd = format(new Date(), 'yyyy-MM-dd');
        const latest = await this.findLatestDbSingInfo();
        if (latest) {
            timeStart = format(latest, 'yyyy-MM-dd');
        }
        const day = differenceInDays(new Date(), new Date(timeStart));
        console.info({ timeStart, timeEnd, day });
        if (day <= 0) return;
        for (let index = 0; index < day; index++) {
            const start = format(addDays(new Date(timeStart), index), 'yyyy-MM-dd');
            const end = format(addDays(new Date(timeStart), index + 1), 'yyyy-MM-dd');
            await this.getTssSignLogs(start, end);
        }
    }
}
