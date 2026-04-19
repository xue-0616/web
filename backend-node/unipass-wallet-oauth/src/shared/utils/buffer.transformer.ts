import { MSG } from './status.msg.code';

// Recovered from dist/buffer.transformer.js.map (source: ../../../src/shared/utils/buffer.transformer.ts)

class BufferTransformer {
    to(value: string | null | undefined): Buffer {
        if (!value) {
            return Buffer.from('0x', 'hex');
        }
        return Buffer.from(value.replace('0x', ''), 'hex');
    }
    from(value: Buffer | null | undefined): string | undefined {
        if (!value) {
            return undefined;
        }
        const hex = `0x${value.toString('hex')}`;
        return hex === MSG.NULL_HEX ? undefined : hex;
    }
}
export const bufferTransformer = new BufferTransformer();
