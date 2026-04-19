export class BaseApiResponse<T = any> {
    data!: T;
    code!: number;
    message!: string;
}

export function SwaggerBaseApiResponse<T>(type: new (...args: any[]) => T, description?: string): any {
    class ExtendedBaseApiResponse extends BaseApiResponse<T> {}
    const isAnArray = Array.isArray(type) ? ' [ ] ' : '';
    Object.defineProperty(ExtendedBaseApiResponse, 'name', {
        value: `SwaggerBaseApiResponseFor ${type} ${isAnArray}`,
    });
    return ExtendedBaseApiResponse;
}
