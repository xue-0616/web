import type { ValueTransformer } from 'typeorm';

class JsonBufferTransformer implements ValueTransformer {
    to(value: string): Buffer {
        return Buffer.from(value, 'utf-8');
    }
    from(value: Buffer | null | undefined): string | undefined {
        if (!value) {
            return undefined;
        }
        const jsonString = value.toString('utf-8');
        return jsonString;
    }
}
export const jsonBufferTransformer = new JsonBufferTransformer();
