export enum StatusName {
    SUCCESS = "success",
    UNPROCESSABLE_ENTITY = "unprocessabeleEntiry",
    SHORT_KEY_NOT_FIND = "shortKeyNotFind",
    ACCOUNT_NOT_FIND = "account_not_find",
}
const SUCCESS = 'success';
const AC_TOKEN_EXPIRE = 'authorization token expire';
const RE_TOKEN_ERROR = 'refresh token data error';
const AC_TOKEN_NOT_FIND = 'authorization access token not find';
const AUTHORIZATION = 'Authorization';
const REFRESH_TOKEN = 'RefreshToken';
const NULL_HEX = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const MSG = {
    NULL_HEX,
    SUCCESS,
    AC_TOKEN_EXPIRE,
    AC_TOKEN_NOT_FIND,
    AUTHORIZATION,
    REFRESH_TOKEN,
    RE_TOKEN_ERROR,
};
const DAY = 24 * 60 * 60;
export const TIME = {
    DAY,
};
export const responseType = {
    unprocessabeleEntiry: { message: 'UNPROCESSABLE ENTITY', statusCode: 422 },
    shortKeyNotFind: { message: 'short key not find', statusCode: 4000 },
    account_not_find: { message: 'account not find', statusCode: 4004 },
};
type ResponseKey = keyof typeof responseType;
export const getResponseData = (
    errorName: string,
): (typeof responseType)[ResponseKey] | undefined =>
    (responseType as Record<string, (typeof responseType)[ResponseKey]>)[errorName];
