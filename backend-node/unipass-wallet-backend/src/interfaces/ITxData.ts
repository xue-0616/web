export enum SigType {
    SigMasterKey = 0,
    SigRecoveryEmail = 1,
    SigMasterKeyWithRecoveryEmail = 2,
    SigSessionKey = 3,
    SigNone = 4,
}

export enum ActionType {
    UpdateKeysetHash = 0,
    UpdateTimeLock = 1,
}
