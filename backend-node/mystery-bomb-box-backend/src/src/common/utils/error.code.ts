import { IStatusCodeInfo } from '../interface/status.code.info';

export enum StatusName {
    SUCCESS = "success",
    ParameterException = "parameterException",
}
const SUCCESS = 'success';
export const responseType = {
    Success: { message: SUCCESS, code: 200 },
    parameterException: {
        message: 'Invalid parameter, please try again.',
        code: 4000,
    },
};
export const MSG = {
    SUCCESS,
};
export const getResponseData = (errorName: string): any =>
    (responseType as Record<string, any>)[errorName];
