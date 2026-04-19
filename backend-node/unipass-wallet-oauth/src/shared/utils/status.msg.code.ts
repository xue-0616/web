// Recovered from dist/status.msg.code.js.map (source: ../../../src/shared/utils/status.msg.code.ts)

const SUCCESS = 'success';
const SUBJECT_CODE = 'UniPass Verification Code';
const SUBJECT_GUARDIAN = 'UniPass Guardian Invitation';
const EMAIL_DKIM_FAIL = 'DKIM verification failed';
const EMAIL_SUBJECT_ERROR = 'subject error';
const EMAIL_SUBJECT_NOT_FIND = 'subject bind data not find';
const EMAIL_NOT_MATCH = 'Not consistent with the guardian Email';
const EMAIL_RECOVERY_FAIL = 'Account recovery failed';
const EMAIL_RECOVERY_COMPLETED = 'Account recovery completed';
const GUARDIAN_UPDATE_FAILED = 'guardian update failed';
const EMAIL_START_RECOVERY = 'Account recovery started';
const EMAIL_CANCEL_RECOVERY = 'Account cancel recovery';
const NOTIFY_UNIPASS = 'UniPass Notification';
const NOTIFY_REGISTER_SUCCESS = 'Sign up successfully';
const NOTIFY_ADD_GUARDIAN_SUCCESS = 'Add guardian successfully';
const NOTIFY_DELETE_GUARDIAN_SUCCESS = 'Delete guardian successfully';
const AC_TOKEN_EXPIRE = 'authorization token expire';
const RE_TOKEN_ERROR = 'refresh token data error';
const AC_TOKEN_NOT_FIND = 'authorization access token not find';
const AUTHORIZATION = 'Authorization';
const REFRESH_TOKEN = 'RefreshToken';
const NULL_HEX = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const MSG = {
    NULL_HEX,
    SUCCESS,
    SUBJECT_CODE,
    SUBJECT_GUARDIAN,
    EMAIL_DKIM_FAIL,
    EMAIL_SUBJECT_ERROR,
    EMAIL_SUBJECT_NOT_FIND,
    EMAIL_NOT_MATCH,
    EMAIL_START_RECOVERY,
    EMAIL_CANCEL_RECOVERY,
    EMAIL_RECOVERY_FAIL,
    EMAIL_RECOVERY_COMPLETED,
    NOTIFY_UNIPASS,
    GUARDIAN_UPDATE_FAILED,
    AC_TOKEN_EXPIRE,
    AC_TOKEN_NOT_FIND,
    AUTHORIZATION,
    REFRESH_TOKEN,
    RE_TOKEN_ERROR,
    NOTIFY_REGISTER_SUCCESS,
    NOTIFY_ADD_GUARDIAN_SUCCESS,
    NOTIFY_DELETE_GUARDIAN_SUCCESS,
};
export const SIG_PREFIX = {
    LOGIN: 'login UniPass:',
    UPDATE_GUARDIAN: 'update guardian:',
    UPLOAD: 'up master key server upload request:',
    BIND_2FA: 'bind 2FA:',
    UNBIND_2FA: 'unbind 2FA:',
    UPDATE_2FA: 'update 2FA:',
    QUERY_SYNC_STATUS: 'query sync status:',
    GET_SYNC_TRANSACTION: 'get sync transaction:',
}
const DAY = 24 * 60 * 60;
const HALF_HOUR = 30 * 60;
const ONE_MINUTE = 1 * 60;
const HALF_A_MINUTE = 1 * 30;
const TOKEN_ID_ONE_HOUR = 30 * 60;
export const TIME = {
    DAY,
    TOKEN_ID_ONE_HOUR,
    HALF_HOUR,
    ONE_MINUTE,
    HALF_A_MINUTE,
};
export const responseType = {
    unprocessabeleEntiry: { message: 'UNPROCESSABLE ENTITY', statusCode: 422 },
    opreationFrequent: {
        message: 'Your operation is too frequent, please try again later',
        statusCode: 1000,
    },
    optCodeError: { message: 'Otp code error', statusCode: 1001 },
    maxVerifyTimes: { message: 'Maximum verify times', statusCode: 1002 },
    maxSendTimes: { message: 'Maximum sending times', statusCode: 1006 },
    otpTokenError: { message: 'upAuthToken verify error', statusCode: 1008 },
    optCodeNotFind: { message: 'otp code not find', statusCode: 1009 },
    ipVerifyError: {
        message: 'The daily limit for SMS requests has been reached. Please try again tomorrow.',
        statusCode: 5030,
    },
};
export enum StatusName {
    SUCCESS = 'success',
    OPERATION_FREQUENT = 'opreationFrequent',
    MAX_SEND_TIMES = 'maxSendTimes',
    MAX_VERIFY_TIMES = 'maxVerifyTimes',
    OTP_CODE_ERROR = 'optCodeError',
    OTP_CODE_NOT_FIND = 'optCodeNotFind',
    UNPROCESSABLE_ENTITY = 'unprocessabeleEntiry',
    OTP_TOKEN_ERROR = 'otpTokenError',
    IP_VERIFY_ERROR = 'ipVerifyError',
}
type ResponseKey = keyof typeof responseType;
export const getResponseData = (
    errorName: StatusName | ResponseKey,
): (typeof responseType)[ResponseKey] | undefined => {
    // StatusName.SUCCESS intentionally has no entry in `responseType`; callers
    // rely on the undefined return to detect the success case.
    return (responseType as Record<string, (typeof responseType)[ResponseKey]>)[errorName];
};
