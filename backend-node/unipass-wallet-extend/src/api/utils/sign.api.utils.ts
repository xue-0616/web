import { TypedData } from '@unipasswallet/popup-utils';
import { TypedDataDomain, TypedDataField } from 'ethers';
import { Bytes, concat, keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { Prefix } from '../dto/sign.input';

export class FatPayHeaderInfo {
    // HTTP headers are case-insensitive; Express lowercases them on ingress,
    // so use lowercase keys to match runtime access patterns.
    'x-fp-version'!: string;
    'x-fp-timestamp'!: number;
    'x-fp-nonce'!: number;
    'x-fp-partner-id'!: string;
    'x-fp-signature'!: string;
}

export class RequestContext {
    requestID!: string;
    url!: string;
    ip!: string;
    headers!: Record<string, string> | FatPayHeaderInfo;
}

export function uniPassHashMessage(message: Bytes | string): string {
    if (typeof message === 'string') {
        message = toUtf8Bytes(message);
    }
    return keccak256(concat([
        toUtf8Bytes(Prefix.UniPassPrefix),
        toUtf8Bytes(String(message.length)),
        message,
    ]));
}

// Stub exports needed by decompiled consumers (original implementations were tree-shaken away)
export function verifyTypedData(...args: any[]): any { throw new Error('verifyTypedData: stub, implementation missing from decompiled bundle'); }
