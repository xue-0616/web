import { CKB_UNIT, RgbppTokenInfo, encodeRgbppTokenInfo, genBtcTimeLockScript, remove0x } from '@rgbpp-sdk/ckb';

export const UNLOCKABLE_LOCK_SCRIPT = {
    codeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    hashType: 'data',
    args: '0x',
};
export const calculateRgbppTokenInfoCellCapacity = (tokenInfo: any, isMainnet: any) => {
    const btcTimeLock = genBtcTimeLockScript(exports.UNLOCKABLE_LOCK_SCRIPT, isMainnet);
    const lockSize = remove0x(btcTimeLock.args).length / 2 + 33;
    const cellDataSize = remove0x(encodeRgbppTokenInfo(tokenInfo)).length / 2;
    const typeSize = 32 + 1 + 20;
    const cellSize = lockSize + typeSize + 8 + cellDataSize;
    return BigInt(cellSize) * CKB_UNIT;
};
const BTC_TIME_CELL_INCREASED_SIZE = 95;
const RGBPP_LOCK_SIZE = 32 + 1 + 36;
export const calculateRgbppCellCapacity = (xudtType: any) => {
    const typeArgsSize = xudtType ? remove0x(xudtType.args).length / 2 : 32;
    const udtTypeSize = 33 + typeArgsSize;
    const cellSize = RGBPP_LOCK_SIZE + udtTypeSize + 8 + 16 + BTC_TIME_CELL_INCREASED_SIZE;
    return BigInt(cellSize + 1) * CKB_UNIT;
};
