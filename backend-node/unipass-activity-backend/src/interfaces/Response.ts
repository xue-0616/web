import { ApiProperty } from '@nestjs/swagger';

export class BaseApiResponse {
    @ApiProperty()
    statusCode: any;
    @ApiProperty()
    message: any;
}

export function SwaggerBaseApiResponse(type: any, description?: string): any {
    class ExtendedBaseApiResponse extends BaseApiResponse {
        @ApiProperty({ type, description })
        declare data: any;
    }
    const isAnArray = Array.isArray(type) ? ' [ ] ' : '';
    Object.defineProperty(ExtendedBaseApiResponse, 'name', {
        value: `SwaggerBaseApiResponseFor ${type} ${isAnArray}`,
    });
    return ExtendedBaseApiResponse;
}
