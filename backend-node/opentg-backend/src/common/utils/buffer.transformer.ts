import type { ValueTransformer } from 'typeorm';

class BufferTransformer implements ValueTransformer {
    to(value: string | null | undefined): Buffer | null {
        if (!value) {
            return null;
        }
        return Buffer.from(value.replace('0x', ''), 'hex');
    }
    from(value: Buffer | null | undefined): string | undefined {
        if (!value) {
            return undefined;
        }
        const hex = `0x${value.toString('hex')}`;
        return hex;
    }
}
export const bufferTransformer = new BufferTransformer();
