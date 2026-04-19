import { IStatusCodeInfo } from '../interface/status.code.info';

export enum StatusName {
    SUCCESS = "success",
    ParameterException = "parameterException",
    AuthError = "authError",
    MessageNotFind = "messageNotFind",
    ServiceError = "serviceError",
}
const SUCCESS = 'success';
export const responseType = {
    Success: { message: SUCCESS, code: 200 },
    parameterException: {
        message: 'Invalid parameter, please try again.',
        code: 4000,
    },
    authError: {
        message: 'auth hash error.',
        code: 4001,
    },
    messageNotFind: {
        message: 'message not find.',
        code: 4002,
    },
};
export const MSG = {
    SUCCESS,
};
export const getResponseData = (errorName: string): any =>
    (responseType as Record<string, any>)[errorName];
