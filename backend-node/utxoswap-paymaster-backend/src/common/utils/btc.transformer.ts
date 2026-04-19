import type { ValueTransformer } from 'typeorm';

class BtcBufferTransformer implements ValueTransformer {
    to(value: string | null | undefined): Buffer | null {
        if (!value) {
            return null;
        }
        return Buffer.from(value, 'hex');
    }
    from(value: Buffer | null | undefined): string | undefined {
        if (!value) {
            return undefined;
        }
        const hex = `${value.toString('hex')}`;
        return hex;
    }
}
export const btcBufferTransformer = new BtcBufferTransformer();
