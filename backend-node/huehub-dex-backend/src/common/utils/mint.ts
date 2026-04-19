import { PsbtTxInput, payments } from 'bitcoinjs-lib';
import { remove0x } from 'ckb-omiga';
import { sha256 } from 'bitcoinjs-lib/src/crypto';

export function getMintOpReturn(xudtHash, txInput) {
    const bufferIndex = Buffer.alloc(4);
    bufferIndex.writeUInt32LE(txInput.index, 0);
    const bufferOutIndex = Buffer.alloc(1);
    bufferOutIndex.writeUInt8(1, 0);
    const hash1 = Buffer.from(remove0x(xudtHash), 'hex');
    const hash2 = sha256(Buffer.concat([hash1, Buffer.concat([txInput.hash, bufferIndex])]));
    return {
        script: payments.embed({
            data: [Buffer.concat([hash1, hash2.slice(0, 20), bufferOutIndex])],
        }).output,
        value: 0,
    };
}
