

export class IndexerTokensInput {
    tokenTypeHash!: string;
}

export class IndexerResponse<T> {
    code!: string;
    message!: string;
    data!: T;
}

export class IndexerTokenInfoList {
    list!: IndexerToken[];
}

export class IndexerToken {
    tokenTypeHash!: string;
    supply!: string;
    holders!: string;
}

export class HolderInfo {
    tokenTypeHash!: string;
    amount!: string;
    ratio!: string;
    address!: string;
}

export class HolderList {
    ckbBlockHeight!: number;
    btcBlockHeight!: number;
    list!: HolderInfo[];
}

export class AccountBalanceInfo {
    tokenTypeHash!: string;
    amount!: string;
}

export class AccountBalanceList {
    list!: AccountBalanceInfo[];
}

export class OutpointInfo {
    index!: number;
    txHash!: string;
}

export class AccountTokenOutpointInfo {
    amount!: string;
    ckbOutPoint!: OutpointInfo;
    btcOutPoint!: OutpointInfo;
    btcValue!: string;
}

export class AccountTokenOutpointList {
    tokenTypeHash!: string;
    amount!: string;
    list!: AccountTokenOutpointInfo[];
}

export class MintTxsCount {
    count!: number;
}
