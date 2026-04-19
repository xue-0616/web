export enum StatusName {
    SUCCESS = "success",
    OPERATION_FREQUENT = "opreationFrequent",
    MAX_SEND_TIMES = "maxSendTimes",
    MAX_VERIFY_TIMES = "maxVerifyTimes",
    OTP_CODE_ERROR = "optCodeError",
    OTP_CODE_NOT_FIND = "optCodeNotFind",
    UNPROCESSABLE_ENTITY = "unprocessabeleEntiry",
    OTP_TOKEN_ERROR = "otpTokenError",
    GUARDIAN_VERIFY_ERROR = "guardianVerifyError",
    ACCOUNT_EXISTS = "accountExists",
    KEYSET_NOT_EXISTS = "keysetNotExists",
    EMAIL_NOT_EXISTS = "emailNotExists",
    SIG_TIME_OUT = "sigTimeOut",
    KEY_SET_ERROR = "keySetError",
    CERDENTIALD_NOT_REGIATER = "credentialIDNotRegister",
    WEBAUTHN_ADD_TIMEOUT = "webauthnAddTimeout",
    WEBAUTHN_VERIFY_ERROR = "webauthnVerifyError",
    CLOUD_KEY_SIG_ERROR = "materKeySigError",
    PERMIT_AUTH_SIG_ERROR = "permitAuthSigError",
    META_NOCER_ERROR = "metaNonceError",
    ACCOUNT_NOT_IN_RECOVERY = "accountNotInRecovery",
    ACCOUNT_IN_PENDING = "accountInPending",
    BIND_2FA_DATA_NOT_FIND = "bind2faDataNotFind",
    GA_VERIFY_ERROR = "gaVerifyError",
    TSS_ERROR = "tssError",
    TSS_AUDIT_ERROR = "tssAuditError",
    KEYSET_ERROR = "keysetError",
    PROVIDER_HTTP_ERROR = "providerHttpError",
    TARGET_META_NONCE_ERROR = "targetMateNonceError",
    SYNC_AUTH_EMAIL_NOT_FIND = "syncEmailNotFindError",
    ACCESS_TOKEN_ERROR = "accessTokenError",
    RECOVERY_GUARDIAN_AUTH_ERROR = "recoveryGuardianAuthError",
    IDTOKEN_INFO_ERROR = "idTokenInfoError",
    POLICY_KEY_INVALID = "policyKeyInvalid",
    KEYSET_GUARDIAN_ADDED = "keysetGuardianAdded",
    UP_SIGN_TOKEN_ERROR = "upSignTokenError",
    IP_VERIFY_ERROR = "ipVerifyError",
    CAPTCHA_VERIFY_ERROR = "captchaVerifyError",
    AP_SIG_ERROR = "apSigError",
    INSUFFICIENT_AP = "insufficientAPbalance",
    DATA_NOT_EXISTS = "dataNotExists",
    DATA_EXISTS = "dataExists",
    ADDRESS_ERROR = "addressError",
    CHAIN_ID_NOT_SUPPORT = "chainIdNotSupport",
    APPID_NOT_SUPPORT = "appIdNotSupport",
    WEB3AUTH_ERROR = "web3authError",
    MIGRATE_SIG_ERROR = "migrateSigError",
}
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
const TURNSTILE_TOKEN_NOT_FIND = 'turnstile response not find';
const AUTHORIZATION = 'Authorization';
const REFRESH_TOKEN = 'RefreshToken';
const TURNSTILE_TOKEN = 'turnstile-resp';
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
    TURNSTILE_TOKEN_NOT_FIND,
    TURNSTILE_TOKEN,
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
    AP_ISSUE: 'UniPass:AP:Issue:',
    TO_B_APP: 'UniPass:ToB:',
    AP_TX: 'UniPassApTx',
};
const MINUTES_OF_DAY = 24 * 60;
const DAY = 24 * 60 * 60;
const HALF_HOUR = 30 * 60;
const ONE_MINUTE = 1 * 60;
const HALF_A_MINUTE = 1 * 30;
const TOKEN_ID_ONE_HOUR = 30 * 60;
export const TIME = {
    DAY,
    MINUTES_OF_DAY,
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
    otpTokenError: { message: 'access token error', statusCode: 1008 },
    optCodeNotFind: { message: 'otp code not find', statusCode: 1009 },
    materKeySigError: {
        message: 'mater key sig error',
        statusCode: 3000,
    },
    credentialIDNotRegister: {
        message: 'credentialID not register',
        statusCode: 3001,
    },
    sigTimeOut: { message: 'sign time out', statusCode: 3006 },
    metaNonceError: { message: 'meta nonce error', statusCode: 4001 },
    chainIdNotSupport: {
        message: 'chain id not support',
        statusCode: 4002,
    },
    emailNotExists: { message: 'account not exists', statusCode: 5000 },
    keySetError: { message: 'key set error', statusCode: 5002 },
    keysetNotExists: {
        message: 'account keyset raw data no find',
        statusCode: 5004,
    },
    accountInPending: { message: 'account in pending', statusCode: 5005 },
    permitAuthSigError: {
        message: ' master key sig error',
        statusCode: 5006,
    },
    webauthnAddTimeout: {
        message: '2fa add webauthn timeout',
        statusCode: 5007,
    },
    webauthnVerifyError: {
        message: 'webAuthn verify error',
        statusCode: 5009,
    },
    accountExists: { message: 'signUp email exists', statusCode: 5011 },
    guardianVerifyError: { message: 'guardian verify error', statusCode: 5014 },
    accountNotInRecovery: {
        message: 'account not in recovery',
        statusCode: 5015,
    },
    bind2faDataNotFind: { message: 'bind 2fa data not find', statusCode: 5016 },
    tssError: { message: 'tss error', statusCode: 5017 },
    keysetError: { message: 'keyset json error', statusCode: 5018 },
    targetMateNonceError: {
        message: 'target chain meta nonce error',
        statusCode: 5019,
    },
    syncEmailNotFindError: {
        message: 'sync email not find',
        statusCode: 5020,
    },
    providerHttpError: {
        message: 'provider could not detect network ',
        statusCode: 5021,
    },
    accessTokenError: {
        message: 'access token error data not find',
        statusCode: 5022,
    },
    recoveryGuardianAuthError: {
        message: 'when recovery register email need auth by oAuth',
        statusCode: 5024,
    },
    tssAuditError: {
        message: 'tss sign audit error',
        statusCode: 5025,
    },
    idTokenInfoError: {
        message: 'id_token info error',
        statusCode: 5026,
    },
    policyKeyInvalid: {
        message: 'policy Key Invalid',
        statusCode: 5027,
    },
    keysetGuardianAdded: {
        message: 'keyset guardian was added',
        statusCode: 5028,
    },
    upSignTokenError: {
        message: 'up sign token error',
        statusCode: 5029,
    },
    ipVerifyError: {
        message: 'The daily limit for SMS requests has been reached. Please try again tomorrow.',
        statusCode: 5030,
    },
    captchaVerifyError: {
        message: 'captcha verify error',
        statusCode: 5031,
    },
    web3authError: {
        message: 'web3auth verify error',
        statusCode: 5032,
    },
    apSigError: {
        message: 'ap verify sig error',
        statusCode: 6001,
    },
    insufficientAPbalance: {
        message: 'insufficient AP balance',
        statusCode: 6002,
    },
    dataNotExists: {
        message: 'data not exists',
        statusCode: 6003,
    },
    dataExists: {
        message: 'data is exists',
        statusCode: 6004,
    },
    appIdNotSupport: {
        message: 'appId not support',
        statusCode: 7000,
    },
    addressError: {
        message: 'address error',
        statusCode: 8000,
    },
    migrateSigError: {
        message: 'migrate sig error',
        statusCode: 9000,
    },
};
export const getResponseData = (errorName: any) => exports.responseType[errorName];
