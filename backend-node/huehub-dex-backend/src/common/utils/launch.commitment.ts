import { sha256 } from 'bitcoinjs-lib/src/crypto';
import { payments } from 'bitcoinjs-lib';

export function getMintOpReturn(xudtHash: any, txHash: any) {
    const bufferIndex = Buffer.alloc(4);
    bufferIndex.writeUInt32LE(0, 0);
    const bufferOutIndex = Buffer.alloc(4);
    bufferOutIndex.writeUInt32LE(1, 0);
    const hash1 = Buffer.from(xudtHash, 'hex');
    const hash2 = sha256(Buffer.concat([hash1, txHash, bufferIndex]));
    return {
        script: payments.embed({
            data: [Buffer.concat([hash1, hash2.slice(0, 20), bufferOutIndex])],
        }).output,
        value: 0,
    };
}
