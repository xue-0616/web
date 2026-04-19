import { ValueTransformer } from 'typeorm';
import { isNullOrUndefined } from './tools';

export class MultipleAmountTransformer implements ValueTransformer {
    to(value: number[] | null): string | null {
            return isNullOrUndefined(value)
                ? null
                : (value as number[]).map((v) => v.toString(10)).join(',');
        }
    from(value: string | null): number[] | null {
            return isNullOrUndefined(value)
                ? null
                : (value as string).split(',').map((v) => parseInt(v));
        }
}

export const multipleAmountTransformer = new MultipleAmountTransformer();
