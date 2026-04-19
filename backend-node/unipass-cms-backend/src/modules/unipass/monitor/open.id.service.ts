import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
// ethers v6: BigNumber removed — use native BigInt/Number
import { TopicEventType } from '../../../modules/unipass/class/chain.class';
import { QueryAbiService } from '../../../modules/unipass/chain/query-abi.service';
import { getOpenIdKeyInfo, parseOpenIdData } from '../../../modules/unipass/chain/utils';
import { IStatisticsDto } from '../../../modules/unipass/dto/unipass.dto';
import { OpenIdInfo, OpenIdPublicKeyInfo } from '../../../modules/unipass/monitor/class';
import { ApiConfigService } from '../../../shared/services/api-config.service';
import { RedisService } from '../../../shared/services/redis.service';
import { UpHttpService } from '../../../shared/services/up.http.service';

type PaginationResult<T> = {
    list: T[];
    pagination: { total: number; size: number; page: number };
};

@Injectable()
export class OpenIdService {
    constructor(
        private readonly apiConfigService: ApiConfigService,
        private readonly upHttpService: UpHttpService,
        private readonly queryAbiService: QueryAbiService,
        private readonly redisService: RedisService,
    ) {}

    async getOpenIdInfoData(dto: IStatisticsDto): Promise<{ event: PaginationResult<any>; openIdInfo: PaginationResult<OpenIdInfo> }> {
        const openIdInfo = await this.getOpenIdInfo();
        const event = await this.getOpenIdChainInfo(dto, openIdInfo.list);
        return { event, openIdInfo };
    }

    async getOpenIdChainInfo(dto: IStatisticsDto, openIdInfo: OpenIdInfo[]): Promise<PaginationResult<any>> {
        const { start, end, limit = 10, page = 1 } = dto as IStatisticsDto & { limit?: number; page?: number };
        const startValue = String(start ?? '');
        const endValue = String(end ?? '');
        const key = `OpenIdChainInfo:${start}_${end}`;
        const dataList = await this.redisService.getRedis().get(key);
        const openIdMap = new Map<string, string>();
        for (const item of openIdInfo) {
            openIdMap.set(item.publicKey, item.kid);
        }
        const data = dataList
            ? JSON.parse(dataList)
            : await this.queryAbiService.getChainUpdateOpenId(startValue, endValue);
        if (!dataList) {
            await this.redisService.getRedis().set(key, JSON.stringify(data), 'EX', 60 * 5);
        }
        const deletMap = this.getDeletEventMap(data[0] || []);
        const list: any[] = [];
        for (const item of data[1] || []) {
            const type = TopicEventType[item.topics[0]];
            item.gasUsed = String(BigInt(item.gasUsed));
            item.gasPrice = String(BigInt(item.gasPrice));
            item.timeStamp = format(new Date(Number(BigInt(item.timeStamp)) * 1000), 'yy-MM-dd HH:mm:ss');
            if (!item.data) {
                continue;
            }
            const publicKeyInfo = parseOpenIdData(item.data);
            if (deletMap.get(publicKeyInfo.mapKey)) {
                continue;
            }
            const isMatch = openIdMap.has(publicKeyInfo.publicKey);
            list.push({ ...item, type, ...publicKeyInfo, isMatch });
        }
        return {
            list,
            pagination: {
                total: list.length,
                size: limit,
                page,
            },
        };
    }

    getDeletEventMap(eventInfo: any[]): Map<string, OpenIdPublicKeyInfo> {
        const delMap = new Map<string, OpenIdPublicKeyInfo>();
        for (const item of eventInfo) {
            if (!item.data) {
                continue;
            }
            const publicKeyInfo = parseOpenIdData(item.data);
            delMap.set(publicKeyInfo.mapKey, publicKeyInfo);
        }
        return delMap;
    }

    async getOpenIdInfo(): Promise<PaginationResult<OpenIdInfo>> {
        const openIdCertsInfo = [
            {
                iss: this.apiConfigService.getOpenIdConfig().googleIss,
                certsUrl: this.apiConfigService.getOpenIdConfig().googleCertsUrl,
            },
            {
                iss: this.apiConfigService.getOpenIdConfig().authUniPassIss,
                certsUrl: this.apiConfigService.getOpenIdConfig().authUniPassCertsUrl,
            },
        ];
        const key = `OpenIdInfo`;
        const dataList = await this.redisService.getRedis().get(key);
        let list: OpenIdInfo[] = [];
        if (!dataList) {
            for (const item of openIdCertsInfo) {
                const data = await this.upHttpService.httpGet(item.certsUrl);
                list = list.concat(getOpenIdKeyInfo(data.keys, item.certsUrl));
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
