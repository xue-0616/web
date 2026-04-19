import { ValueTransformer } from 'typeorm';
import { isNullOrUndefined } from './tools';

export class BigIntTransformer implements ValueTransformer {
    to(value: bigint | null): string | null {
            return isNullOrUndefined(value) ? null : (value as bigint).toString();
        }
    from(value: string | null): bigint | null {
            return isNullOrUndefined(value) ? null : BigInt(value as string);
        }
}

export const bigintTransformer = new BigIntTransformer();
