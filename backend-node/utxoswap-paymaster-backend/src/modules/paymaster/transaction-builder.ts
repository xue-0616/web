import { Collector, IndexerCell, MAX_FEE, SECP256K1_WITNESS_LOCK_SIZE, append0x, calculateTransactionFee, getSecp256k1CellDep } from '@rgbpp-sdk/ckb';
import { AddressPrefix, addressToScript, getTransactionSize, privateKeyToAddress } from '@nervosnetwork/ckb-sdk-utils';

export class DispatcherTransactionBuilder {
    constructor(
        private readonly collector: Collector,
        private readonly isMainnet: boolean,
        private readonly ownerKey: string,
    ) {}
    generateCandidateCellTransaction(emptyCells: IndexerCell[], candidateCellCapacity: bigint, candidateCellCount: number): CKBComponents.RawTransactionToSign {
        const address = privateKeyToAddress(this.ownerKey, {
            prefix: this.isMainnet ? AddressPrefix.Mainnet : AddressPrefix.Testnet,
        });
        const masterLock = addressToScript(address);
        let txFee = MAX_FEE;
        const totalCandidateCellCapacity = BigInt(candidateCellCapacity) * BigInt(candidateCellCount);
        const { inputs, sumInputsCapacity } = this.collector.collectInputs(emptyCells, totalCandidateCellCapacity, txFee);
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
