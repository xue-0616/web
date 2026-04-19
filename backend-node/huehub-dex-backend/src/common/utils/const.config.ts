const HALF_HOUR = 30 * 60;
const FIVE_MINUTES = 5 * 60;
const TEN_MINUTES = 10 * 60;
const TEN_SECOND = 10;
const ONE_SECOND = 1;
const ONE_MINUTES = 60;
export const BTC_DECIMAL = 8;
export const CKB_DECIMAL = 8;
export const VERSION_V1 = 'api/v1';
export const OPEN_ACCESS = 'open:access';
export const JWT = {
    authorization: 'Authorization',
    tokenExp: 'authorization access token exp',
    tokenNotFind: 'authorization access token not find',
};
export const BTC_UTXO_DUST_LIMIT = 1000;
export const TIME = {
    HALF_HOUR,
    FIVE_MINUTES,
    TEN_MINUTES,
    ONE_MINUTES,
    TEN_SECOND,
    ONE_SECOND,
};
export const QueueDelayTime = (queryTime: any) => {
    if (queryTime < 90) {
        return 20 * 1000;
    }
    if (queryTime < 120) {
        return 60 * 1000;
    }
    if (queryTime < 150) {
        return 2 * 60 * 1000;
    }
    if (queryTime < 174) {
        return 5 * 60 * 1000;
    }
    if (queryTime < 174 + 24) {
        return 10 * 60 * 1000;
    }
    if (queryTime < 174 + 24 + 32) {
        return 30 * 60 * 1000;
    }
    return 30 * 60 * 1000;
};
