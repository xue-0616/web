import { ValueTransformer } from 'typeorm';

export class BufferTransformer implements ValueTransformer {
    to(value: string): Buffer {
            return Buffer.from(value, 'utf-8');
        }
    from(value: Buffer): string | undefined {
            if (!value) {
                return undefined;
            }
            const jsonString = value.toString('utf-8');
            return jsonString;
        }
}

export const byteTransformer = new BufferTransformer();
