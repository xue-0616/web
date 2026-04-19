import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addDays, format } from 'date-fns';
import { DataSource } from 'typeorm';
import { IStatisticsDto, IStatisticsEventsDetailsDto, IStatisticsLoginDto, IStatisticsSignupDto } from '../../modules/unipass/dto/unipass.dto';
import { RedisService } from '../../shared/services/redis.service';
import { UpHttpService } from '../../shared/services/up.http.service';

type PaginatedResult<T = any> = {
    list: T[];
    pagination: {
        total: number;
        size: number;
        page: number;
        allCount?: any;
    };
};

@Injectable()
export class StatisticsService {
    private dataSource!: DataSource;
    private customAutDataSource!: DataSource;
    private defaultDataSource!: DataSource;

    constructor(
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
        private readonly upHttp: UpHttpService,
    ) {
        this.initDataSource();
    }

    private initDataSource(): DataSource {
        const data = this.configService.get('unipass_database') || {};
        this.dataSource = new DataSource({ ...(data as object), name: 'UniPass_db' } as any);
        if (!this.dataSource.isInitialized) {
            void this.dataSource.initialize().catch(() => undefined);
        }

        const customAuthData = this.configService.get('custom_auth_database') || {};
        this.customAutDataSource = new DataSource({ ...(customAuthData as object), name: 'custom_auth_db' } as any);
        if (!this.customAutDataSource.isInitialized) {
            void this.customAutDataSource.initialize().catch(() => undefined);
        }

        const defaultData = this.configService.get('database') || {};
        this.defaultDataSource = new DataSource({ ...(defaultData as object), name: 'default' } as any);
        if (!this.defaultDataSource.isInitialized) {
            void this.defaultDataSource.initialize().catch(() => undefined);
        }

        return this.dataSource;
    }

    private getDateText(value?: string | number): string {
        if (!value) {
            return format(new Date(), 'yyyy-MM-dd');
        }
        return String(value);
    }

    private getNextDateText(value?: string | number): string {
        const start = new Date(this.getDateText(value));
        return format(addDays(start, 1), 'yyyy-MM-dd');
    }

    private getPage(dto: IStatisticsDto | IStatisticsEventsDetailsDto): number {
        return Number((dto as any).page || 1);
    }

    private getLimit(dto: IStatisticsDto | IStatisticsEventsDetailsDto): number {
        return Number((dto as any).limit || 10);
    }

    async statisticsSignUp(dto: IStatisticsDto): Promise<PaginatedResult<IStatisticsSignupDto>> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const skip = (page - 1) * limit;
        const manager = this.dataSource.manager;
        const select = `select FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day, source, count(id) as totalCount from accounts where created_at >"${timeStart}" and created_at <="${timeEnd}" and status = 2`;
        const group = `group by day,source order by day desc limit ${skip},${limit}`;
        const sql = source ? `${select} and source = "${source}" ${group}` : `${select} ${group}`;
        const list = await manager.query(sql);
        const select2 = `select count(*) as total from (select FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day, source from accounts where created_at >"${timeStart}" and created_at <="${timeEnd}" and status = 2`;
        const group2 = `group by day,source) s`;
        const sql2 = source ? `${select2} and source = "${source}" ${group2}` : `${select2} ${group2}`;
        const [{ total }] = await manager.query(sql2);
        const allCount = await this.statisticsTotalSignUp(dto);
        return { list, pagination: { total: Number(total), size: limit, page, allCount } };
    }

    async statisticsTotalSignUp(dto: IStatisticsDto): Promise<any> {
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const key = `${timeStart}_${timeEnd}_${source}_totalSignUp`;
        const info = await this.redisService.getRedis().get(key);
        if (info) {
            return JSON.parse(info);
        }
        const manager = this.dataSource.manager;
        const select = `select count(*) as total from accounts where created_at >"${timeStart}" and created_at <="${timeEnd}" and status = 2`;
        const sql = source ? `${select} and source = "${source}"` : select;
        const [data] = await manager.query(sql);
        await this.redisService.getRedis().set(key, JSON.stringify(data), 'EX', 60 * 5);
        return data;
    }

    async statisticsLogin(dto: IStatisticsDto): Promise<PaginatedResult<IStatisticsLoginDto>> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const skip = (page - 1) * limit;
        const manager = this.dataSource.manager;
        const select = `select count(*) as total, FROM_UNIXTIME(UNIX_TIMESTAMP(r.created_at),'%Y-%m-%d') as day, Sum(times) as totalTimes, count(account_id) totalAccounts, a.source as source from login_records r join accounts a on a.id = r.account_id where r.created_at >"${timeStart}" and r.created_at <="${timeEnd}"`;
        const group = `group by day,source order by day desc limit ${skip},${limit}`;
        const sql = source ? `${select} and a.source = "${source}" ${group}` : `${select} ${group}`;
        const list = await manager.query(sql);
        const select2 = `select count(*) as total from (select count(*) from login_records r join accounts a on a.id = r.account_id where r.created_at >"${timeStart}" and r.created_at <="${timeEnd}"`;
        const group2 = `group by day,source) s`;
        const sql2 = source ? `${select2} and a.source = "${source}" ${group2}` : `${select2} ${group2}`;
        const [{ total }] = await manager.query(sql2);
        const allCount = await this.statisticsTotalLogin(dto);
        return { list, pagination: { total: Number(total), size: limit, page, allCount } };
    }

    async statisticsTotalLogin(dto: IStatisticsDto): Promise<any> {
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const key = `${timeStart}_${timeEnd}_${source}_totalLogin`;
        const info = await this.redisService.getRedis().get(key);
        if (info) {
            return JSON.parse(info);
        }
        const manager = this.dataSource.manager;
        const select = `select Sum(times) as totalTimes, count(account_id) totalAccounts from login_records r join accounts a on a.id = r.account_id where r.created_at >"${timeStart}" and r.created_at <="${timeEnd}"`;
        const sql = source ? `${select} and a.source = "${source}"` : select;
        const [data] = await manager.query(sql);
        await this.redisService.getRedis().set(key, JSON.stringify(data), 'EX', 60 * 5);
        return data;
    }

    async statisticsSign(dto: IStatisticsDto): Promise<PaginatedResult> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const skip = (page - 1) * limit;
        const manager = this.defaultDataSource.manager;
        const select = `select count(*) as totalCount, FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day, source from statistics_sign where created_at >"${timeStart}" and created_at <="${timeEnd}"`;
        const group = `group by day,source order by day desc limit ${skip},${limit}`;
        const sql = source ? `${select} and source = "${source}" ${group}` : `${select} ${group}`;
        const list = await manager.query(sql);
        const select2 = `select count(*) as total from (select count(*), FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day, source from statistics_sign where created_at >"${timeStart}" and created_at <="${timeEnd}"`;
        const group2 = `group by day,source) s`;
        const sql2 = source ? `${select2} and source = "${source}" ${group2}` : `${select2} ${group2}`;
        const [{ total }] = await manager.query(sql2);
        const allCount = await this.statisticsTotalSign(dto);
        return { list, pagination: { total: Number(total), size: limit, page, allCount } };
    }

    async statisticsTotalSign(dto: IStatisticsDto): Promise<any> {
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const key = `${timeStart}_${timeEnd}_${source}_TotalSign`;
        const info = await this.redisService.getRedis().get(key);
        if (info) {
            return JSON.parse(info);
        }
        const manager = this.defaultDataSource.manager;
        const select = `select count(*) total from statistics_sign where created_at >"${timeStart}" and created_at <="${timeEnd}"`;
        const sql = source ? `${select} and source = "${source}"` : select;
        const [data] = await manager.query(sql);
        await this.redisService.getRedis().set(key, JSON.stringify(data), 'EX', 60 * 5);
        return data;
    }

    async statisticsOnedayInfo(dto: IStatisticsDto): Promise<any> {
        const timeStart = dto.start ? String(dto.start) : this.getDateText();
        const timeEnd = this.getNextDateText(timeStart);
        dto.start = timeStart;
        dto.end = timeEnd;
        const { total } = await this.statisticsTotalSignUp(dto);
        const { totalTimes, totalAccounts } = await this.statisticsTotalLogin(dto);
        return { total, totalTimes: totalTimes || 0, totalAccounts };
    }

    async statisticsOneDayLogin(dto: IStatisticsDto): Promise<PaginatedResult> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : this.getDateText();
        const timeEnd = this.getNextDateText(timeStart);
        const skip = (page - 1) * limit;
        const manager = this.dataSource.manager;
        const select = `select FROM_UNIXTIME(UNIX_TIMESTAMP(r.created_at),'%Y-%m-%d %H') as day, Sum(times) as totalTimes, count(account_id) totalAccounts from login_records r join accounts a on a.id = r.account_id where r.created_at >"${timeStart}" and r.created_at <="${timeEnd}"`;
        const group = `group by day order by day desc limit ${skip},${limit}`;
        const sql = source ? `${select} and a.source = "${source}" ${group}` : `${select} ${group}`;
        const list = await manager.query(sql);
        const select2 = `select count(*) as total from (select count(*), FROM_UNIXTIME(UNIX_TIMESTAMP(r.created_at),'%Y-%m-%d %H') as day from login_records r join accounts a on a.id = r.account_id where r.created_at >"${timeStart}" and r.created_at <="${timeEnd}"`;
        const group2 = `group by day) s`;
        const sql2 = source ? `${select2} and a.source = "${source}" ${group2}` : `${select2} ${group2}`;
        const [{ total }] = await manager.query(sql2);
        return { list, pagination: { total: Number(total), size: limit, page } };
    }

    async statisticsOneDaySignUp(dto: IStatisticsDto): Promise<PaginatedResult> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : this.getDateText();
        const timeEnd = this.getNextDateText(timeStart);
        const skip = (page - 1) * limit;
        const manager = this.dataSource.manager;
        const select = `select FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d %H') as day, count(id) as totalCount from accounts where created_at >"${timeStart}" and created_at <="${timeEnd}" and status = 2`;
        const group = `group by day order by day desc limit ${skip},${limit}`;
        const sql = source ? `${select} and source = "${source}" ${group}` : `${select} ${group}`;
        const list = await manager.query(sql);
        const select2 = `select count(*) as total from (select FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d %H') as day from accounts where created_at >"${timeStart}" and created_at <="${timeEnd}" and status = 2`;
        const group2 = `group by day) s`;
        const sql2 = source ? `${select2} and source = "${source}" ${group2}` : `${select2} ${group2}`;
        const [{ total }] = await manager.query(sql2);
        return { list, pagination: { total: Number(total), size: limit, page } };
    }

    async statisticsEvent(dto: IStatisticsDto, topics: string): Promise<PaginatedResult> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const skip = (page - 1) * limit;
        const manager = this.defaultDataSource.manager;
        const select = `select count(*) as totalCount, FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day, source from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" and topics = "${topics}"`;
        const group = `group by day,source order by day desc limit ${skip},${limit}`;
        const sql = source ? `${select} and source = "${source}" ${group}` : `${select} ${group}`;
        const list = await manager.query(sql);
        const select2 = `select count(*) as total from (select count(*) as totalCount, FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day, source from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" and topics = "${topics}"`;
        const group2 = `group by day,source) s`;
        const sql2 = source ? `${select2} and source = "${source}" ${group2}` : `${select2} ${group2}`;
        const [{ total }] = await manager.query(sql2);
        const allCount = await this.statisticsTotalEvent(dto, topics);
        return { list, pagination: { total: Number(total), size: limit, page, allCount } };
    }

    async statisticsTotalEvent(dto: IStatisticsDto, topics: string): Promise<any> {
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const manager = this.defaultDataSource.manager;
        const select = `select count(*) total from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" and topics = "${topics}"`;
        const sql = source ? `${select} and source = "${source}"` : select;
        const [data] = await manager.query(sql);
        return data;
    }

    async statisticsAccountsTransaction(dto: IStatisticsDto): Promise<PaginatedResult> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const skip = (page - 1) * limit;
        const manager = this.defaultDataSource.manager;
        const sql = `select count(*) as totalCount, FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" group by day order by day desc limit ${skip},${limit}`;
        const list = await manager.query(sql);
        const sql2 = `select count(*) as total from (select count(*) as totalCount, FROM_UNIXTIME(UNIX_TIMESTAMP(created_at),'%Y-%m-%d') as day from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" group by day) s`;
        const [{ total }] = await manager.query(sql2);
        const allCount = await this.statisticsTotalAccountsTransaction(dto);
        return { list, pagination: { total: Number(total), size: limit, page, allCount } };
    }

    async statisticsTotalAccountsTransaction(dto: IStatisticsDto): Promise<any> {
        const { source } = dto;
        const timeStart = dto.start ? String(dto.start) : '2022-11-15';
        const timeEnd = dto.end ? String(dto.end) : this.getDateText();
        const manager = this.defaultDataSource.manager;
        const select = `select count(*) total from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}"`;
        const sql = source ? `${select} and source = "${source}"` : select;
        const [data] = await manager.query(sql);
        return data;
    }

    async statisticsDetailsEvent(dto: IStatisticsEventsDetailsDto): Promise<PaginatedResult> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const { topics, source } = dto;
        const size = limit || 10;
        const timeStart = String(dto.day);
        const timeEnd = this.getNextDateText(dto.day);
        const skip = (page - 1) * size;
        const manager = this.defaultDataSource.manager;
        let sql = `select address, created_at, transactionHash, email from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" and topics = "${topics}" order by created_at desc limit ${skip},${limit}`;
        if (source) {
            sql = `select address, created_at, transactionHash, email from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" and topics = "${topics}" and source = "${source}" order by created_at desc limit ${skip},${limit}`;
        }
        const list = await manager.query(sql);
        let sql2 = `select count(*) as totalCount from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" and topics = "${topics}"`;
        if (source) {
            sql2 = `select count(*) as totalCount from statistics_event where created_at >"${timeStart}" and created_at <="${timeEnd}" and topics = "${topics}" and source = "${source}"`;
        }
        const [{ totalCount }] = await manager.query(sql2);
        return { list, pagination: { total: Number(totalCount), size, page } };
    }

    async walletRegisterStatistics(dto: IStatisticsDto): Promise<PaginatedResult> {
        const page = this.getPage(dto);
        const limit = this.getLimit(dto);
        const size = limit || 10;
        const skip = (page - 1) * size;
        const today = this.getDateText();
        const range = `limit ${skip},${size}`;
        const tocSql = `select source, provider, created_at as createdAt, status from accounts where status in (1,2) and created_at >= "${today}" order by created_at desc ${range}`;
        const tobSql = `select caai.app_name as source, caa.created_at as createdAt, caa.status from custom_auth_accounts caa join custom_auth_app_infos caai on caa.app_id = caai.app_id where caa.status in (1,2) and caa.created_at >= "${today}" order by caa.created_at desc ${range}`;
        const manager = this.dataSource.manager;
        const customAutDataManager = this.customAutDataSource.manager;
        let todayTocList: any[] = [];
        let todayTobList: any[] = [];
        try {
            todayTocList = await manager.query(tocSql);
        } catch (error: any) {
            console.error(error?.message);
        }
        try {
            todayTobList = await customAutDataManager.query(tobSql);
        } catch (error: any) {
            console.error(error?.message);
        }
        const countTocSql = `select count(*) as total from accounts where status in (1,2) and created_at >= "${today}"`;
        const countTobSql = `select count(*) as total from custom_auth_accounts caa join custom_auth_app_infos caai on caa.app_id = caai.app_id where caa.status in (1,2) and caa.created_at >= "${today}"`;
        let countToc: any[] = [];
        let countTob: any[] = [];
        try {
            countToc = await manager.query(countTocSql);
        } catch (error: any) {
            console.error(error?.message);
        }
        try {
            countTob = await customAutDataManager.query(countTobSql);
        } catch (error: any) {
            console.error(error?.message);
        }
        const total = Number(countToc.length > 0 ? countToc[0].total : 0) + Number(countTob.length > 0 ? countTob[0].total : 0);
        const list = [...todayTocList, ...todayTobList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const allCount = await this.getRegisterCount();
        return { list, pagination: { total, size, page, allCount } };
    }

    async getRegisterCount(): Promise<number> {
        const manager = this.dataSource.manager;
        const customAutDataManager = this.customAutDataSource.manager;
        const countTocSql = `select count(*) as total from accounts where status = 2`;
        const countTobSql = `select count(*) as total from custom_auth_accounts caa join custom_auth_app_infos caai on caa.app_id = caai.app_id where caa.status = 2`;
        let countToc: any[] = [];
        let countTob: any[] = [];
        try {
            countToc = await manager.query(countTocSql);
        } catch (error: any) {
            console.error(error?.message);
        }
        try {
            countTob = await customAutDataManager.query(countTobSql);
        } catch (error: any) {
            console.error(error?.message);
        }
        return Number(countToc.length > 0 ? countToc[0].total : 0) + Number(countTob.length > 0 ? countTob[0].total : 0);
    }
}
