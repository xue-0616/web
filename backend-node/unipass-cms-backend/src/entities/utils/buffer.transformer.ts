import type { ValueTransformer } from 'typeorm';

const NULL_HEX = '0x0000000000000000000000000000000000000000000000000000000000000000';
class BufferTransformer {
    to(value: any): Buffer {
        if (!value) {
            return Buffer.from('0x', 'hex');
        }
        return Buffer.from(value.replace('0x', ''), 'hex');
    }
    from(value: any): string | undefined {
        if (!value) {
            return undefined;
        }
        const hex = `0x${value.toString('hex')}`;
        return hex === NULL_HEX ? undefined : hex;
    }
}
export const bufferTransformer = new BufferTransformer();
