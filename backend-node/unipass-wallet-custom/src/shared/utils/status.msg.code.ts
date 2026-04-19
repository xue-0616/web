export enum StatusName {
    SUCCESS = "success",
    ACCOUNT_NOT_EXISTS = "accountNotExists",
    UNPROCESSABLE_ENTITY = "unprocessabeleEntiry",
    ADDRESS_ERROR = "addressError",
    AP_SIG_ERROR = "apSigError",
    APPID_NOT_SUPPORT = "appIdNotSupport",
    WEB3AUTH_ERROR = "web3authError",
    RAW_DATA_NOT_FIND = "rawDataNotExists",
    PROVIDER_HTTP_ERROR = "providerHttpError",
    ACCOUNT_EXISTS = "accountExists",
    KEYSET_ERROR = "keysetError",
    TSS_ERROR = "tssError",
    OPERATION_FREQUENT = "opreationFrequent",
    RELAYER_SIG_ERROR = "relayerSigError",
}
export const API_VERSION_PREFIX = 'api/v1';
export const OPEN_API_PREFIX = 'open-api';
export const MSG = {
    SUCCESS: 'success',
    AUTHORIZATION: 'Authorization',
    AC_TOKEN_NOT_FIND: 'authorization access token not find',
    AC_TOKEN_EXPIRE: 'authorization token expire',
    NULL_HEX: '0x0000000000000000000000000000000000000000000000000000000000000000',
};
export const SIG_PREFIX = {
    UPLOAD: '',
    TO_B_APP: 'UniPass:ToB:',
};
const MINUTES_OF_DAY = 24 * 60;
const DAY = 24 * 60 * 60;
const ONE_HOUR = 60 * 60;
const ONE_MINUTE = 1 * 60;
const HALF_A_MINUTE = 1 * 30;
const HALF_A_HOUR = 30 * 60;
export const TIME = {
    DAY,
    MINUTES_OF_DAY,
    HALF_A_HOUR,
    ONE_HOUR,
    ONE_MINUTE,
    HALF_A_MINUTE,
};
export const responseType = {
    unprocessabeleEntiry: { message: 'UNPROCESSABLE ENTITY', statusCode: 422 },
    opreationFrequent: {
        message: 'Your operation is too frequent, please try again later',
        statusCode: 1000,
    },
    accountNotExists: { message: 'account not exists', statusCode: 5000 },
    keySetError: { message: 'key set error', statusCode: 5002 },
    rawDataNotExists: {
        message: 'account keyset raw data no find',
        statusCode: 5004,
    },
    accountExists: { message: 'account is exists', statusCode: 5011 },
    tssError: { message: 'tss error', statusCode: 5017 },
    providerHttpError: {
        message: 'provider could not detect network ',
        statusCode: 5021,
    },
    web3authError: {
        message: 'web3auth verify error',
        statusCode: 5032,
    },
    apSigError: {
        message: 'admin verify sig error',
        statusCode: 6001,
    },
    appIdNotSupport: {
        message: 'appId not support',
        statusCode: 7000,
    },
    addressError: {
        message: 'address error',
        statusCode: 8000,
    },
    relayerSigError: {
        message: 'relayer sig error',
        statusCode: 1001,
    },
};
type ResponseKey = keyof typeof responseType;
export const getResponseData = (
    errorName: string,
): (typeof responseType)[ResponseKey] | undefined =>
    (responseType as Record<string, (typeof responseType)[ResponseKey]>)[errorName];
