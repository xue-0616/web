import { MSG } from './status.msg.code';

export class BufferTransformer {
    to(value: any) {
            if (!value) {
                return Buffer.from('0x', 'hex');
            }
            return Buffer.from(value.replace('0x', ''), 'hex');
        }
    from(value: any) {
            if (!value) {
                return undefined;
            }
            const hex = `0x${value.toString('hex')}`;
            return hex === MSG.NULL_HEX ? undefined : hex;
        }
}

export const bufferTransformer = new BufferTransformer();
