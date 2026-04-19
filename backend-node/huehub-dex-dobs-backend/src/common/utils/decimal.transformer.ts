import { ValueTransformer } from 'typeorm';
import Decimal from 'decimal.js';

export class DecimalTransformer implements ValueTransformer {
    to(value: Decimal): string | undefined {
            if (!value) {
                return undefined;
            }
            return value.toString();
        }
    from(value: string): Decimal | undefined {
            if (!value) {
                return undefined;
            }
            return new Decimal(value);
        }
}

export const decimalTransformer = new DecimalTransformer();
