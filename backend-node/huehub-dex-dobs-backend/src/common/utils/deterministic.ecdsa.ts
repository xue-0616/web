import { ECPairInterface } from 'ecpair';
const { signSync, utils } = require('@noble/secp256k1');
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { crypto } from 'bitcoinjs-lib';

utils.hmacSha256Sync = (key: any, ...msgs: any[]) => hmac(sha256, key, utils.concatBytes(...msgs));
const MAGIC_BYTES = Buffer.from('Bitcoin Signed Message:\n');
function varintBufNum(n: any) {
    let buf;
    if (n < 253) {
        buf = Buffer.alloc(1);
        buf.writeUInt8(n, 0);
    }
    else if (n < 0x10000) {
        buf = Buffer.alloc(1 + 2);
        buf.writeUInt8(253, 0);
        buf.writeUInt16LE(n, 1);
    }
    else if (n < 0x100000000) {
        buf = Buffer.alloc(1 + 4);
        buf.writeUInt8(254, 0);
        buf.writeUInt32LE(n, 1);
    }
    else {
        buf = Buffer.alloc(1 + 8);
        buf.writeUInt8(255, 0);
        buf.writeInt32LE(n & -1, 1);
        buf.writeUInt32LE(Math.floor(n / 0x100000000), 5);
    }
    return buf;
}
function magicHash(message: any) {
    const prefix1 = varintBufNum(MAGIC_BYTES.length);
    const messageBuffer = Buffer.from(message);
    const prefix2 = varintBufNum(messageBuffer.length);
    const buf = Buffer.concat([prefix1, MAGIC_BYTES, prefix2, messageBuffer]);
    return crypto.hash256(buf);
}
function toCompact(i: any, signature: any, compressed: any) {
    if (!(i === 0 || i === 1 || i === 2 || i === 3)) {
        throw new Error('i must be equal to 0, 1, 2, or 3');
    }
    let val = i + 27 + 4;
    if (!compressed) {
        val = val - 4;
    }
    return Buffer.concat([Uint8Array.of(val), Uint8Array.from(signature)]);
}
export function signMessageOfDeterministicECDSA(ecpair: any, message: any) {
    const hash = magicHash(message);
    const [signature, i] = signSync(Buffer.from(hash), ecpair.privateKey.toString('hex'), {
        canonical: true,
        recovered: true,
        der: false,
    });
    return toCompact(i, signature, true).toString('base64');
}
