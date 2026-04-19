export class IssueActionPointOutput {
    apInfo?: any;
    historyList?: any[];
}

export class ApHistoryList {
    accountId?: string;
    actionPointDiff?: number;
    changeType?: string;
    status?: string;
    changeTime?: string;
    changeMsg?: string;
}

export class AdminGetActionPointBalanceOutput {
    availActionPoint?: number;
    discount?: number;
    id?: string;
    lockActionPoint?: number;
}
