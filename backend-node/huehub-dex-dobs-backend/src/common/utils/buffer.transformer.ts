import { ValueTransformer } from 'typeorm';

export class BufferTransformer implements ValueTransformer {
    to(value: string): Buffer | null {
            if (!value) {
                return null;
            }
            return Buffer.from(value.replace('0x', ''), 'hex');
        }
    from(value: Buffer): string | undefined {
            if (!value) {
                return undefined;
            }
            const hex = `${value.toString('hex')}`;
            return hex;
        }
}

export const bufferTransformer = new BufferTransformer();
