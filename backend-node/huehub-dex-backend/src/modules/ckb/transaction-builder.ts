import { Collector, IndexerCell, MAX_FEE, SECP256K1_WITNESS_LOCK_SIZE, append0x, buildRgbppLockArgs, calculateTransactionFee, genRgbppLockScript, getSecp256k1CellDep } from '@rgbpp-sdk/ckb';
import { AddressPrefix, addressToScript, getTransactionSize, privateKeyToAddress, rawTransactionToHash } from '@nervosnetwork/ckb-sdk-utils';

export type UTXO = any;

export class DispatcherTransactionBuilder {
    constructor(private collector: Collector, private isMainnet: boolean, private ownerKey: string) {
    }
    generateRgbLockCellTransaction(utxo: UTXO, inputCell: IndexerCell): {
        signedTx: CKBComponents.RawTransaction;
        predicatedCell: IndexerCell;
    } {
            const isMainnet = this.isMainnet;
            let txFee = MAX_FEE;
            const launchCellCapacity = BigInt(inputCell.output.capacity) - txFee;
            const { inputs, sumInputsCapacity } = this.collector.collectInputs([inputCell], launchCellCapacity, txFee, BigInt(0));
            const outputs = [
                {
                    lock: genRgbppLockScript(buildRgbppLockArgs(utxo.index, utxo.txHash), isMainnet),
                    capacity: append0x(launchCellCapacity.toString(16)),
                },
            ];
            const outputsData = ['0x'];
            const emptyWitness = { lock: '', inputType: '', outputType: '' };
            const witnesses = inputs.map((_, index) => index === 0 ? emptyWitness : '0x');
            const cellDeps = [getSecp256k1CellDep(isMainnet)];
            const unsignedTx = {
                version: '0x0',
                cellDeps,
                headerDeps: [],
                inputs,
                outputs,
                outputsData,
                witnesses,
            };
            const signedTx = this.collector.getCkb().signTransaction(this.ownerKey)(unsignedTx);
            const txHash = rawTransactionToHash(signedTx);
            const predicatedCell = {
                blockNumber: '0x0',
                txIndex: '0x0',
                output: outputs[0],
                outPoint: {
                    txHash,
                    index: '0x0',
                },
                outputData: '',
            };
            return { signedTx, predicatedCell };
        }
    generateCandidateCellTransaction(emptyCells: IndexerCell[], candidateCellCapacity: bigint, candidateCellCount: number): CKBComponents.RawTransactionToSign {
            const address = privateKeyToAddress(this.ownerKey, {
                prefix: this.isMainnet ? AddressPrefix.Mainnet : AddressPrefix.Testnet,
            });
            const masterLock = addressToScript(address);
            let txFee = MAX_FEE;
            const totalCandidateCellCapacity = BigInt(candidateCellCapacity) * BigInt(candidateCellCount);
            const { inputs, sumInputsCapacity } = this.collector.collectInputs(emptyCells, totalCandidateCellCapacity, txFee, BigInt(0));
            const outputs = Array(candidateCellCount).fill({
                lock: masterLock,
                capacity: append0x(BigInt(candidateCellCapacity).toString(16)),
            });
            let changeCapacity = sumInputsCapacity - totalCandidateCellCapacity;
            outputs.push({
                lock: masterLock,
                capacity: append0x(changeCapacity.toString(16)),
            });
            const outputsData = Array(candidateCellCount + 1).fill('0x');
            const emptyWitness = { lock: '', inputType: '', outputType: '' };
            const witnesses = inputs.map((_, index) => index === 0 ? emptyWitness : '0x');
            const cellDeps = [getSecp256k1CellDep(this.isMainnet)];
            const unsignedTx = {
                version: '0x0',
                cellDeps,
                headerDeps: [],
                inputs,
                outputs,
                outputsData,
                witnesses,
            };
            const txSize = getTransactionSize(unsignedTx) + SECP256K1_WITNESS_LOCK_SIZE;
            const estimatedTxFee = calculateTransactionFee(txSize);
            changeCapacity -= estimatedTxFee;
            unsignedTx.outputs[unsignedTx.outputs.length - 1].capacity = append0x(changeCapacity.toString(16));
            return unsignedTx;
        }
}
