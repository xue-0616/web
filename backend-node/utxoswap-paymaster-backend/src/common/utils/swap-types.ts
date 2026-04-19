export enum TokeInputsType {
    Swap = 0,
    Create = 1,
    Add = 2,
}

export enum IntentTransactionStatus {
    Pending = 0,
    Success = 1,
    Refound = 2,
    Rejected = 3,
}

export enum IntentType {
    CreatePool = 0,
    AddLiquidity = 1,
    RemoveLiquidity = 2,
    SwapExactInputForOutput = 3,
    SwapInputForExactOutput = 4,
    ClaimProtocolLiquidity = 5,
}

export enum PoolStatus {
    NotCreate = 0,
    Pending = 1,
    Created = 2,
}

export enum IntentStatus {
    NotCreate = 0,
    Pending = 1,
    Created = 2,
}

export interface Pool {
    typeHash: string;
    assetX: { typeHash: string; reserve: string | number | bigint };
    assetY: { typeHash: string; reserve: string | number | bigint };
    [key: string]: any;
}

export interface GetPoolResponse {
    pool?: Pool;
    status: PoolStatus;
    [key: string]: any;
}

export interface SequencerConfigurations {
    intentLock: { codeHash: string; hashType: string };
    [key: string]: any;
}
