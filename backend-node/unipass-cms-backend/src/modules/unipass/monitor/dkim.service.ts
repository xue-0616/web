import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
// ethers v6: BigNumber removed — use native BigInt/Number
import { TopicEventType } from '../../../modules/unipass/class/chain.class';
import { QueryAbiService } from '../../../modules/unipass/chain/query-abi.service';
import { getDnsInfo, parseDkimKeyData } from '../../../modules/unipass/chain/utils';
import { IStatisticsDto } from '../../../modules/unipass/dto/unipass.dto';
import { DkimKeyDNSInfo, DkimKeyInfo } from '../../../modules/unipass/monitor/class';
import { RedisService } from '../../../shared/services/redis.service';

type PaginationResult<T> = {
    list: T[];
    pagination: { total: number; size: number; page: number };
};

@Injectable()
export class DkimService {
    constructor(
        private readonly queryAbiService: QueryAbiService,
        private readonly redisService: RedisService,
    ) {}

    async getDkimInfo(dto: IStatisticsDto): Promise<{ dnsInfo: PaginationResult<DkimKeyDNSInfo>; chainInfo: PaginationResult<any> }> {
        return this.getDkimChainEventInfo(dto);
    }

    async getDkimChainEventInfo(dto: IStatisticsDto): Promise<{ dnsInfo: PaginationResult<DkimKeyDNSInfo>; chainInfo: PaginationResult<any> }> {
        const { start, end, limit = 10, page = 1 } = dto as IStatisticsDto & { limit?: number; page?: number };
        const startValue = String(start ?? '');
        const endValue = String(end ?? '');
        const key = `getDkimChainInfo:${start}_${end}`;
        const dataList = await this.redisService.getRedis().get(key);
        const data = dataList ? JSON.parse(dataList) : await this.queryAbiService.getUpdateDkimEvents(startValue, endValue);
        if (!dataList) {
            await this.redisService.getRedis().set(key, JSON.stringify(data), 'EX', 60 * 5);
        }
        const list: any[] = [];
        const emailMaps = new Map<string, DkimKeyInfo>();
        const deletMap = this.getDeletEventMap(data[0] || []);
        for (const item of data[1] || []) {
            const type = TopicEventType[item.topics[0]];
            item.gasUsed = String(BigInt(item.gasUsed));
            item.gasPrice = String(BigInt(item.gasPrice));
            item.timeStamp = format(new Date(Number(BigInt(item.timeStamp)) * 1000), 'yy-MM-dd HH:mm:ss');
            if (!item.data) {
                continue;
            }
            const publicKeyInfo = parseDkimKeyData(item.data);
            if (deletMap.get(publicKeyInfo.emailServer)) {
                continue;
            }
            if (!emailMaps.has(publicKeyInfo.emailServer)) {
                emailMaps.set(publicKeyInfo.emailServer, publicKeyInfo);
            }
            list.push({ ...item, type, ...publicKeyInfo });
        }
        const dnsInfo = await this.getDkimDnsInfo(emailMaps);
        const dnsMap = new Map<string, DkimKeyDNSInfo>();
        for (const item of dnsInfo.list) {
            dnsMap.set(item.hostname, item);
        }
        const chainList = list.map((item) => {
            const hostName = `${item.selector}._domainkey.${item.sdid}`;
            const dnsData = dnsMap.get(hostName);
            return {
                ...item,
                isMatch: dnsData ? dnsData.publicKey === item.publicKey.replace('0x', '00') : false,
            };
        });
        return {
            dnsInfo,
            chainInfo: {
                list: chainList,
                pagination: { total: chainList.length, size: limit, page },
            },
        };
    }

    getDeletEventMap(eventInfo: any[]): Map<string, DkimKeyInfo> {
        const delMap = new Map<string, DkimKeyInfo>();
        for (const item of eventInfo) {
            if (!item.data) {
                continue;
            }
            const publicKeyInfo = parseDkimKeyData(item.data);
            delMap.set(publicKeyInfo.emailServer, publicKeyInfo);
        }
        return delMap;
    }

    async getDkimDnsInfo(emailMaps: Map<string, DkimKeyInfo>): Promise<PaginationResult<DkimKeyDNSInfo>> {
        const key = `getDkimDnsInfo`;
        const dataList = await this.redisService.getRedis().get(key);
        let list: DkimKeyDNSInfo[] = [];
        if (!dataList) {
            for (const [mapKey, value] of emailMaps) {
                const hostName = `${value.selector}._domainkey.${value.sdid}`;
                const dkimKeyInfo = await getDnsInfo(hostName);
                list.push({ ...dkimKeyInfo, key: mapKey });
            }
            await this.redisService.getRedis().set(key, JSON.stringify(list), 'EX', 60 * 5);
        } else {
            list = JSON.parse(dataList);
        }
        return {
            list,
            pagination: { total: list.length, size: list.length, page: 1 },
        };
    }
}
