import { LoggerService } from 'nest-logger';

export class RequestContext {
    requestID!: string;
    url!: string;
    ip!: string;
    headers!: Record<string, string> | FatPayHeaderInfo;
}

export class FatPayHeaderInfo {
    'x-fp-version'!: string;
    'x-fp-timestamp'!: number;
    'x-fp-nonce'!: number;
    'x-fp-partner-id'!: string;
    'x-fp-signature'!: string;
}

export function sortRequestParameters(...args: any[]): any { throw new Error('sortRequestParameters: stub'); }
export function verifyFatPaySignature(...args: any[]): any { throw new Error('verifyFatPaySignature: stub'); }
