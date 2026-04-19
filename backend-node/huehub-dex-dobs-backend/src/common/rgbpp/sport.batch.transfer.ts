import { Collector, Hex, IndexerCell, NoRgbppLiveCellError, RGBPP_TX_WITNESS_MAX_SIZE, RGBPP_WITNESS_PLACEHOLDER, RgbppUtxoBindMultiSporesError, append0x, buildPreLockArgs, calculateCommitment, calculateTransactionFee, compareInputs, deduplicateList, genRgbppLockScript, generateSporeTransferCoBuild, getRgbppLockConfigDep, getRgbppLockDep, getSporeTypeDep } from '@rgbpp-sdk/ckb';
import { getTransactionSize, serializeScript } from '@nervosnetwork/ckb-sdk-utils';

export type SporeTransferVirtualTxResult = any;

export const genBatchTransferSporeCkbVirtualTx = async ({ collector, sporeRgbppLockArgs, sporeTypeBytesList, isMainnet, witnessLockPlaceholderSize, ckbFeeRate, }: { collector: any; sporeRgbppLockArgs: any; sporeTypeBytesList: any; isMainnet: any; witnessLockPlaceholderSize?: any; ckbFeeRate?: any; }) => {
    const skipIndex = sporeRgbppLockArgs.length;
    const deduplicatedLockArgsList = deduplicateList(sporeRgbppLockArgs);
    if (sporeTypeBytesList.length !== deduplicatedLockArgsList.length) {
        throw new NoRgbppLiveCellError('cell type length not match cell lock length');
    }
    const sporeRgbppLock = deduplicatedLockArgsList.map((args) => genRgbppLockScript(args, isMainnet));
    let sporeCells: any[] = [];
    for await (const rgbppLock of sporeRgbppLock) {
        const cells = await collector.getCells({
            lock: rgbppLock,
            isDataMustBeEmpty: false,
        });
        if (!cells || cells.length === 0) {
            throw new NoRgbppLiveCellError('No spore rgbpp cells found with the spore rgbpp lock args');
        }
        sporeCells = [...sporeCells, ...cells];
    }
    if (!sporeCells || sporeCells.length === 0) {
        throw new NoRgbppLiveCellError('No spore rgbpp cells found with the spore rgbpp lock args');
    }
    sporeCells = sporeCells.sort(compareInputs);
    sporeCells.map((sporeCell) => {
        if (!sporeCell.output.type) {
            throw new RgbppUtxoBindMultiSporesError('The cell with the rgbpp lock args has no spore asset');
        }
        const serializedTypeScript = append0x(serializeScript(sporeCell.output.type));
        if (!sporeTypeBytesList.includes(serializedTypeScript)) {
            throw new RgbppUtxoBindMultiSporesError('The cell type with the rgbpp lock args does not match');
        }
    });
    let inputs = [];
    let sumInputsCapacity = BigInt(0);
    let outputs = [];
    let outputsData = [];
    let changeCapacity = BigInt(0);
    for (const [index, rgbppCell] of sporeCells.entries()) {
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
    changeCapacity = BigInt(sporeCells[sporeCells.length - 1].output.capacity);
    if (changeCapacity < 0) {
        throw new Error('Insufficient input capacity for the outputs and transaction fee.');
    }
    const cellDeps = [
        getRgbppLockDep(isMainnet),
        getRgbppLockConfigDep(isMainnet),
        getSporeTypeDep(isMainnet),
    ];
    const sporeCoBuild = generateSporeTransferCoBuild(sporeCells, outputs);
    const witnesses = new Array(sporeCells.length)
        .fill(RGBPP_WITNESS_PLACEHOLDER)
        .concat(sporeCoBuild);
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
    changeCapacity -= estimatedTxFee;
    if (changeCapacity < 0) {
        throw new Error('Insufficient input capacity for the outputs and transaction fee.');
    }
    ckbRawTx.outputs[ckbRawTx.outputs.length - 1].capacity = append0x(changeCapacity.toString(16));
    const virtualTx = {
        ...ckbRawTx,
    };
    const commitment = calculateCommitment(virtualTx);
    return {
        ckbRawTx,
        commitment,
        sporeCells,
        needPaymasterCell: false,
        sumInputsCapacity: sumInputsCapacity.toString(16),
    };
};
