import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { format } from 'date-fns';
import { Repository } from 'typeorm';
import { AccountsEntity } from '../../entities/unipass/accounts.entity';
import { AccountStatus } from '../../entities/unipass/accounts.entity';
import { OriHashEntity } from '../../entities/unipass/ori.hash.entity';
import { AccountHistoryInfo, IStatisticsDto, IUnipassChainInfoListOutput, IUniPassUserChainInfoDto, IUniPassUserDBInfoDto, IUniPassUserInfoOutputDto } from '../../modules/unipass/dto/unipass.dto';
import { QueryAbiService } from '../../modules/unipass/chain/query-abi.service';
import { ApiConfigService } from '../../shared/services/api-config.service';
import { EVENT_TYPE, EventInfo, TopicEventType } from '../../modules/unipass/class/chain.class';
import { RedisService } from '../../shared/services/redis.service';
import { decodeBytes32String } from 'ethers';
import { formatKeysetInfo } from '../../modules/unipass/chain/utils';

@Injectable()
export class UnipassService {
    constructor(
        @InjectRepository(AccountsEntity, 'UniPass_db')
        private readonly accountRepository: Repository<AccountsEntity>,
        @InjectRepository(OriHashEntity, 'UniPass_db')
        private readonly oriHashRepository: Repository<OriHashEntity>,
        private readonly queryAbiService: QueryAbiService,
        private readonly apiConfigService: ApiConfigService,
        private readonly redisService: RedisService,
    ) {}
    async getUniPassUserInfo(where: any): Promise<AccountsEntity[]> {
        const account = await this.accountRepository.find({
            where,
            select: [
                'email',
                'address',
                'keysetHash',
                'initKeysetHash',
                'pendingKeysetHash',
                'createdAt',
                'updatedAt',
                'provider',
                'source',
                'status',
            ],
        });
        return account;
    }
    async getAccountKeysetHash(where: any): Promise<OriHashEntity | null> {
        const account = await this.oriHashRepository.findOne({
            where,
            select: ['raw'],
        });
        return account;
    }
    async getUnipassUserDbInfo(dto: IUniPassUserDBInfoDto): Promise<IUniPassUserInfoOutputDto[]> {
        const { email, address } = dto;
        const userInfoList: IUniPassUserInfoOutputDto[] = [];
        if (!email && !address) {
            return [];
        }
        const where = email ? { email } : { address };
        const account = await this.getUniPassUserInfo(where);
        if (account.length == 0)
            return [];
        for (const item of account) {
            const userInfo = {
                ...item,
                pendingKeysetHashRaw: '',
                keysetHashRaw: '',
                initKeysetHashRaw: '',
            };
            if (item.status == AccountStatus.generateKey) {
                userInfoList.push(userInfo);
                continue;
            }
            if (item.keysetHash) {
                const keysetHash = await this.getAccountKeysetHash({
                    hash: item.keysetHash,
                });
                if (keysetHash)
                    userInfo.keysetHashRaw = JSON.parse(JSON.stringify(keysetHash.raw)).keyset;
                userInfo.keysetHashRaw = formatKeysetInfo(userInfo.keysetHashRaw);
            }
            if (item.initKeysetHash) {
                const initKeysetHash = await this.getAccountKeysetHash({
                    hash: item.initKeysetHash,
                });
                if (initKeysetHash)
                    userInfo.initKeysetHashRaw = JSON.parse(JSON.stringify(initKeysetHash.raw)).keyset;
                userInfo.initKeysetHashRaw = formatKeysetInfo(userInfo.initKeysetHashRaw);
            }
            if (item.pendingKeysetHash) {
                const pendingKeysetHash = await this.getAccountKeysetHash({
                    hash: item.pendingKeysetHash,
                });
                if (pendingKeysetHash)
                    userInfo.pendingKeysetHashRaw = JSON.parse(JSON.stringify(pendingKeysetHash.raw)).keyset;
                userInfo.pendingKeysetHashRaw = formatKeysetInfo(userInfo.pendingKeysetHashRaw);
            }
            userInfoList.push(userInfo);
        }
        return userInfoList;
    }
    async getUnipassUserChainInfo(dto: IUniPassUserChainInfoDto): Promise<IUnipassChainInfoListOutput[]> {
        const { address } = dto;
        const key = `chain_info:${address}`;
        const cacheData = await this.redisService.getRedis().get(key);
        if (cacheData)
            return JSON.parse(cacheData);
        const genChainInfo = this.queryAbiService.getAccountInfo(address, this.apiConfigService.getContractConfig.genNodeName);
        const ethChainInfo = this.queryAbiService.getAccountInfo(address, this.apiConfigService.getContractConfig.ethNodeName);
        const bscChainInfo = this.queryAbiService.getAccountInfo(address, this.apiConfigService.getContractConfig.bscNodeName);
        const [genInfo, ethInfo, bscInfo] = await Promise.all([
            genChainInfo,
            ethChainInfo,
            bscChainInfo,
        ]);
        for (const item of [genInfo, ethInfo, bscInfo]) {
            if (item.keysetHash) {
                const keysetHash = await this.getAccountKeysetHash({
                    hash: item.keysetHash,
                });
                if (keysetHash) {
                    item.keysetHashRaw = JSON.parse(JSON.stringify(keysetHash.raw)).keyset;
                    item.keysetHashRaw = formatKeysetInfo(item.keysetHashRaw);
                }
            }
            if (item.pendingKeysetHash) {
                const pendingKeysetHash = await this.getAccountKeysetHash({
                    hash: item.pendingKeysetHash,
                });
                if (pendingKeysetHash) {
                    item.pendingKeysethashRaw = JSON.parse(JSON.stringify(pendingKeysetHash.raw)).keyset;
                    item.pendingKeysethashRaw = formatKeysetInfo(item.pendingKeysethashRaw);
                }
            }
        }
        const list = [
            {
                ...genInfo,
                chainNode: this.apiConfigService.getContractConfig.genNodeName,
                address,
            },
            {
                ...ethInfo,
                chainNode: this.apiConfigService.getContractConfig.ethNodeName,
                address,
            },
            {
                ...bscInfo,
                chainNode: this.apiConfigService.getContractConfig.bscNodeName,
                address,
            },
        ];
        await this.redisService
            .getRedis()
            .set(key, JSON.stringify(list), 'EX', 60 * 5);
        return list;
    }
    async getUnipassEventInfo(dto: IUniPassUserChainInfoDto): Promise<any> {
        const { address } = dto;
        const where = { address };
        const account = await this.getUniPassUserInfo(where);
        if (account.length == 0)
            return [];
        const key = `event_info:${address}`;
        const cacheData = await this.redisService.getRedis().get(key);
        if (cacheData)
            return JSON.parse(cacheData);
        const contract = await this.queryAbiService.getAccountEventList(address);
        const eventList = this.parseEvent(contract, account[0].initKeysetHash, key);
        return eventList;
    }
    async parseEvent(eventInfoList: EventInfo[], initKeysetHash: string, key: string): Promise<AccountHistoryInfo[]> {
        const list = [];
        for (const item of eventInfoList) {
            const type = TopicEventType[item.topics[0]];
            const data = item.data;
            const parseData = await this.parseEventData(type, data ?? '', initKeysetHash);
            if (!parseData)
                continue;
            item.gasUsed = String(BigInt(item.gasUsed));
            item.gasPrice = String(BigInt(item.gasPrice));
            item.timeStamp = format(Number(BigInt(item.timeStamp)) * 1000, 'yy-MM-dd HH:mm:ss');
            const eventInfo = { ...item, ...parseData };
            list.push(eventInfo);
        }
        await this.redisService
            .getRedis()
            .set(key, JSON.stringify(list), 'EX', 60 * 5);
        return list.reverse();
    }
    async parseEventData(type: EVENT_TYPE, data: string, initKeysetHash?: string): Promise<false | { source: string; keysetHash: string; type: EVENT_TYPE; raw: string }> {
        let keysetHash = '';
        let source = '';
        try {
            switch (type) {
                case EVENT_TYPE.SET_SOURCE:
                    source = decodeBytes32String(data);
                    break;
                case EVENT_TYPE.UPDATE_KEY_SET_HASH:
                case EVENT_TYPE.UPDATE_KEY_SET_HASH_WITH_TIME_LOCK:
                    keysetHash = data.slice(66, data.length);
                    break;
                case EVENT_TYPE.UNLOCL_KEY_SET_HASH:
                    break;
                case EVENT_TYPE.CANCEL_LOCK_KEY_SET_HASH:
                    break;
                case EVENT_TYPE.SYNC_ACCOUNT:
                    break;
                default:
                    return false;
            }
        }
        catch (error) {
            console.error(error);
        }
        if (source && initKeysetHash) {
            keysetHash = initKeysetHash;
        }
        if (!keysetHash) {
            return { source, keysetHash, type, raw: '' };
        }
        const keysetDbData = await this.getAccountKeysetHash({
            hash: keysetHash,
        });
        let raw = keysetDbData ? JSON.parse(JSON.stringify(keysetDbData.raw)).keyset : '';
        raw = formatKeysetInfo(raw);
        return { source, keysetHash, type, raw };
    }
    async getModuleGuestTranascation(dto: IStatisticsDto): Promise<{ list: any[]; pagination: { total: number; size: any; page: any } }> {
        const { start, end, limit, page } = dto;
        const key = `getModuleGuest:${start}_${end}`;
        const dataList = await this.redisService.getRedis().get(key);
        let list = [];
        if (!dataList) {
            let data = await this.queryAbiService.getModuleguestTranascation(String(start), String(end));
            data = data.reverse();
            for (const item of data) {
                item.gasUsed = String(BigInt(item.gasUsed));
                item.gasPrice = String(BigInt(item.gasPrice));
                item.timeStamp = format(Number(BigInt(item.timeStamp)) * 1000, 'yy-MM-dd HH:mm:ss');
                list.push(item);
            }
            await this.redisService
                .getRedis()
                .set(key, JSON.stringify(list), 'EX', 60 * 5);
        }
        else {
            list = JSON.parse(dataList);
        }
        const pagination = {
            total: list.length,
            size: limit,
            page: page,
        };
        return { list, pagination };
    }
}
