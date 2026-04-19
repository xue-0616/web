import { BtcTransferVirtualTxParams, BtcTransferVirtualTxResult, RGBPP_TX_WITNESS_MAX_SIZE, RGBPP_WITNESS_PLACEHOLDER, append0x, buildPreLockArgs, calculateCommitment, calculateRgbppCellCapacity, calculateTransactionFee, compareInputs, genRgbppLockScript, getRgbppLockConfigDep, getRgbppLockDep, getSecp256k1CellDep, getXudtDep, u128ToLe } from '@rgbpp-sdk/ckb';
import { blockchain } from '@ckb-lumos/base';
import { getTransactionSize } from '@nervosnetwork/ckb-sdk-utils';

const GAS_TIMES = 300;
export const genBtcTransferCkbVirtualTx = async ({ collector, xudtTypeBytes, rgbppLockArgsList, transferAmount, isMainnet, noMergeOutputCells }: { collector: any; xudtTypeBytes: any; rgbppLockArgsList: any; transferAmount: any; isMainnet: any; noMergeOutputCells: any }) => {
    const xudtType = blockchain.Script.unpack(xudtTypeBytes);
    const skipIndex = rgbppLockArgsList.length;
    const rgbppLocks = rgbppLockArgsList.map((args: any) => genRgbppLockScript(args, isMainnet));
    let rgbppCells: any[] = [];
    for await (const rgbppLock of rgbppLocks) {
        const cells = await collector.getCells({ lock: rgbppLock, type: xudtType });
        if (!cells || cells.length === 0) {
            throw new Error('No rgbpp cells found with the xudt type script and the rgbpp lock args');
        }
        rgbppCells = [...rgbppCells, ...cells];
    }
    rgbppCells = rgbppCells.sort(compareInputs);
    let inputs = [];
    let sumInputsCapacity = BigInt(0);
    const outputs = [];
    const outputsData = [];
    let changeCapacity = BigInt(0);
    if (noMergeOutputCells) {
        for (const [index, rgbppCell] of rgbppCells.entries()) {
            inputs.push({
                previousOutput: rgbppCell.outPoint,
                since: '0x0',
            });
            sumInputsCapacity += BigInt(rgbppCell.output.capacity);
            outputs.push({
                ...rgbppCell.output,
                lock: genRgbppLockScript(buildPreLockArgs(index + 1 + skipIndex), isMainnet),
            });
            outputsData.push(rgbppCell.outputData);
        }
        changeCapacity = BigInt(rgbppCells[rgbppCells.length - 1].output.capacity);
    }
    else {
        const collectResult = collector.collectUdtInputs({
            liveCells: rgbppCells,
            needAmount: transferAmount,
        });
        inputs = collectResult.inputs;
        sumInputsCapacity = collectResult.sumInputsCapacity;
        rgbppCells = rgbppCells.slice(0, inputs.length);
        const rpbppCellCapacity = calculateRgbppCellCapacity(xudtType as any);
        outputsData.push(append0x(u128ToLe(transferAmount)));
        changeCapacity = sumInputsCapacity;
        outputs.push({
            lock: genRgbppLockScript(buildPreLockArgs(1), isMainnet),
            type: xudtType,
            capacity: append0x(rpbppCellCapacity.toString(16)),
        });
        if (collectResult.sumAmount > transferAmount) {
            outputs.push({
                lock: genRgbppLockScript(buildPreLockArgs(2), isMainnet),
                type: xudtType,
                capacity: append0x(rpbppCellCapacity.toString(16)),
            });
            outputsData.push(append0x(u128ToLe(BigInt(collectResult.sumAmount) - BigInt(transferAmount))));
            changeCapacity -= rpbppCellCapacity;
        }
    }
    const cellDeps = [
        getRgbppLockDep(isMainnet),
        getXudtDep(isMainnet),
        getRgbppLockConfigDep(isMainnet),
    ];
    const needPaymasterCell = inputs.length < outputs.length;
    if (needPaymasterCell) {
        cellDeps.push(getSecp256k1CellDep(isMainnet));
    }
    const witnesses = [];
    const lockArgsSet = new Set();
    for (const cell of rgbppCells) {
        if (lockArgsSet.has(cell.output.lock.args)) {
            witnesses.push('0x');
        }
        else {
            lockArgsSet.add(cell.output.lock.args);
            witnesses.push(RGBPP_WITNESS_PLACEHOLDER);
        }
    }
    const ckbRawTx = {
        version: '0x0',
        cellDeps,
        headerDeps: [],
        inputs,
        outputs,
        outputsData,
        witnesses,
    };
    if (!needPaymasterCell) {
        const txSize = getTransactionSize(ckbRawTx) + RGBPP_TX_WITNESS_MAX_SIZE * GAS_TIMES;
        const estimatedTxFee = calculateTransactionFee(txSize);
        changeCapacity -= estimatedTxFee;
        ckbRawTx.outputs[ckbRawTx.outputs.length - 1].capacity = append0x(changeCapacity.toString(16));
    }
    const virtualTx = {
        ...ckbRawTx,
    };
    const commitment = calculateCommitment(virtualTx);
    return {
        ckbRawTx,
        commitment,
        needPaymasterCell,
        sumInputsCapacity: append0x(sumInputsCapacity.toString(16)),
    };
};
