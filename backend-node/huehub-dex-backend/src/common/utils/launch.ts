import { RgbppLaunchCkbVirtualTxParams, RgbppLaunchVirtualTxResult } from './launch.interface';
import { MAX_FEE, RGBPP_TX_WITNESS_MAX_SIZE, RGBPP_WITNESS_PLACEHOLDER, append0x, calculateCommitment, calculateTransactionFee, encodeRgbppTokenInfo, genBtcTimeLockScript, genRgbppLockScript, generateUniqueTypeArgs, getRgbppLockConfigDep, getRgbppLockDep, getUniqueTypeDep, getUniqueTypeScript, getXudtDep, getXudtTypeScript, u128ToLe } from '@rgbpp-sdk/ckb';
import { addressToScript, getTransactionSize, scriptToHash } from '@nervosnetwork/ckb-sdk-utils';
import { UNLOCKABLE_LOCK_SCRIPT, calculateRgbppTokenInfoCellCapacity } from './ckb.tx';

export const genRgbppLaunchCkbVirtualTx = async ({ collector, ownerRgbppLockArgs, launchAmount, rgbppTokenInfo, witnessLockPlaceholderSize, ckbFeeRate, isMainnet, emptyCells, toCkbAddress, }: { collector: any; ownerRgbppLockArgs: any; launchAmount: any; rgbppTokenInfo: any; witnessLockPlaceholderSize?: any; ckbFeeRate?: any; isMainnet: any; emptyCells: any; toCkbAddress: any; }) => {
    const lock = genBtcTimeLockScript(addressToScript(toCkbAddress), isMainnet);
    const ownerLock = genRgbppLockScript(ownerRgbppLockArgs, isMainnet);
    const infoCellCapacity = calculateRgbppTokenInfoCellCapacity(rgbppTokenInfo, isMainnet);
    let txFee = MAX_FEE;
    const { inputs, sumInputsCapacity } = collector.collectInputs(emptyCells, infoCellCapacity, txFee, { isMax: true });
    let rgbppCellCapacity = sumInputsCapacity - infoCellCapacity;
    const outputs = [
        {
            lock,
            type: {
                ...getXudtTypeScript(isMainnet),
                args: append0x(scriptToHash(ownerLock)),
            },
            capacity: append0x(rgbppCellCapacity.toString(16)),
        },
        {
            lock: genBtcTimeLockScript(UNLOCKABLE_LOCK_SCRIPT as any, isMainnet),
            type: {
                ...getUniqueTypeScript(isMainnet),
                args: generateUniqueTypeArgs(inputs[0], 1),
            },
            capacity: append0x(infoCellCapacity.toString(16)),
        },
    ];
    const outputsData = [
        append0x(u128ToLe(launchAmount)),
        encodeRgbppTokenInfo(rgbppTokenInfo),
    ];
    const cellDeps = [
        getRgbppLockDep(isMainnet),
        getRgbppLockConfigDep(isMainnet),
        getXudtDep(isMainnet),
        getUniqueTypeDep(isMainnet),
    ];
    const witnesses = inputs.map((_: any, index: any) => index === 0 ? RGBPP_WITNESS_PLACEHOLDER : '0x');
    const ckbRawTx = {
        version: '0x0',
        cellDeps,
        headerDeps: [],
        inputs,
        outputs,
        outputsData,
        witnesses,
    };
    const txSize = getTransactionSize(ckbRawTx) +
        (witnessLockPlaceholderSize ?? RGBPP_TX_WITNESS_MAX_SIZE);
    const estimatedTxFee = calculateTransactionFee(txSize, ckbFeeRate);
    rgbppCellCapacity -= estimatedTxFee;
    ckbRawTx.outputs[0].capacity = append0x(rgbppCellCapacity.toString(16));
    const virtualTx = {
        ...ckbRawTx,
        outputs: ckbRawTx.outputs,
    };
    const commitment = calculateCommitment(virtualTx);
    return {
        ckbRawTx,
        commitment,
    };
};
