import { IStatusCodeInfo } from '../interface/status.code.info';

export enum StatusName {
    SUCCESS = "success",
    ParameterException = "parameterException",
    ItemInvalid = "ItemInvalid",
    ServiceFeeNotMatch = "ServiceFeeNotMatch",
    PsbtException = "PsbtException",
    CkbException = "CkbException",
    SignatureError = "SignatureError",
    ItemExisting = "ItemExisting",
    DeployInvalid = "DeployInvalid",
    InsufficientBalance = "InsufficientBalance",
    UtxoNotLive = "UtxoNotLive",
    UtxoValueNotMatch = "UtxoValueNotMatch",
    FeeRateTooLow = "FeeRateTooLow",
}
const SUCCESS = 'success';
export const responseType = {
    Success: { message: SUCCESS, code: 200 },
    parameterException: {
        message: 'Invalid parameter, please try again.',
        code: 4000,
    },
    ItemInvalid: {
        message: 'Item has been purchased or transferred, please refresh and try again.',
        code: 4001,
    },
    ServiceFeeNotMatch: { message: 'Service fee mismatch.', code: 4002 },
    PsbtException: { message: 'Incorrect PSBT signature.', code: 4003 },
    CkbException: { message: 'Incorrect transaction commitment.', code: 4004 },
    SignatureError: {
        message: 'Signature error, please try reconnecting.',
        code: 4005,
    },
    ItemExisting: {
        message: 'This item is already listed, please do not relist.',
        code: 4006,
    },
    DeployInvalid: {
        message: 'This token symbol is taken. Please enter another.',
        code: 4007,
    },
    InsufficientBalance: {
        message: 'Insufficient balance or no available UTXOs.',
        code: 4008,
    },
    UtxoNotLive: {
        message: 'Invalid RGB++ asset format. The bound UTXO has been spent. Please contact the token issuer.',
        code: 4009,
    },
    UtxoValueNotMatch: {
        message: 'Invalid RGB++ asset format. The bound UTXO  is not 546 sats. Please contact the token issuer.',
        code: 4010,
    },
};
export const MSG = {
    SUCCESS,
};
export const getResponseData = (errorName: any) => exports.responseType[errorName];
