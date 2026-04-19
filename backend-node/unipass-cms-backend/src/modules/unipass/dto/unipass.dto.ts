import { PageOptionsDto } from '../../../common/dto/page.dto';

export class IUniPassUserDBInfoDto extends PageOptionsDto {
    email?: string;
    address?: string;
}

export class IUniPassUserInfoOutputDto {
    email!: string;
    address!: string;
    keysetHash!: string;
    initKeysetHash!: string;
    pendingKeysetHash!: string;
    createdAt!: Date;
    updatedAt!: Date;
    provider!: number | string;
    source!: string;
    status!: number;
    keysetHashRaw!: string;
    initKeysetHashRaw!: string;
    pendingKeysetHashRaw!: string;
}

export class IUniPassUserChainInfoDto {
    address!: string;
}

export class IKeysetHashInfo {
    keysetHash!: string;
}

export class IUnipassChainInfo {
    keysetHash!: string;
    pendingKeysetHash!: string;
    unlockTime!: string | number;
    lockDuration!: string | number;
    metaNonce!: string | number;
    isPending!: boolean;
    keysetHashRaw!: string;
    pendingKeysethashRaw!: string;
}

export class IUnipassChainInfoListOutput extends IUnipassChainInfo {
    chainNode!: string;
    address!: string;
}

export class IStatisticsDto extends PageOptionsDto {
    start?: string | number;
    end?: string | number;
    source?: string;
}

export class IStatisticsEventsDto extends PageOptionsDto {
    start?: string | number;
    end?: string | number;
    topics?: string;
    source?: string;
}

export class IStatisticsEventsDetailsDto extends PageOptionsDto {
    day?: string;
    source?: string;
    topics?: string;
}

export class IStatisticsSignupDto {
    day!: string;
    source!: string;
    totalCount!: number;
}

export class IStatisticsLoginDto {
    day!: string;
    source!: string;
    totalTimes!: number;
    totalAccounts!: number;
}

export interface AccountHistoryInfo {
    gasUsed?: string;
    gasPrice?: string;
    timeStamp?: string;
    topics?: string[];
    data?: string;
    source?: string;
    keysetHash?: string;
    type?: string | number;
    raw?: string;
    [key: string]: any;
}
