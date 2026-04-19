import { ValueTransformer } from 'typeorm';

export class Utf8BufferTransformer implements ValueTransformer {
    to(value: string): Buffer | null {
            if (!value) {
                return null;
            }
            return Buffer.from(value, 'utf-8');
        }
    from(value: Buffer): string | undefined {
            if (!value) {
                return undefined;
            }
            const str = value.toString('utf-8');
            return str;
        }
}

export const utf8bufferTransformer = new Utf8BufferTransformer();
