import { ValueTransformer } from 'typeorm';

export class BtcBufferTransformer implements ValueTransformer {
    to(value: string): Buffer | null {
            if (!value) {
                return null;
            }
            return Buffer.from(value, 'hex');
        }
    from(value: Buffer): string | undefined {
            if (!value) {
                return undefined;
            }
            const hex = `${value.toString('hex')}`;
            return hex;
        }
}

export const btcBufferTransformer = new BtcBufferTransformer();
