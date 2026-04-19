// Recovered from dist/Response.js.map (source: ../../src/interfaces/Response.ts)

export class BaseApiResponse<T> {
    data!: T;
    meta?: Record<string, any>;
}

export function SwaggerBaseApiResponse<T>(type: new (...args: any[]) => T): any {
    class ExtendedBaseApiResponse {
        data!: T;
    }
    const isAnArray = Array.isArray(type) ? ' [ ] ' : '';
    Object.defineProperty(ExtendedBaseApiResponse, 'name', {
        value: `SwaggerBaseApiResponseFor ${type} ${isAnArray}`,
    });
    return ExtendedBaseApiResponse;
}
