import { ValueTransformer } from 'typeorm';

const NULL_HEX = '0x';

export class BufferTransformer implements ValueTransformer {
    to(value: string): Buffer {
            if (!value) {
                return Buffer.from('0x', 'hex');
            }
            return Buffer.from(value.replace('0x', ''), 'hex');
        }
    from(value: Buffer): string | undefined {
            if (!value) {
                return undefined;
            }
            const hex = `0x${value.toString('hex')}`;
            return hex === NULL_HEX ? undefined : hex;
        }
}

export const bufferTransformer = new BufferTransformer();
