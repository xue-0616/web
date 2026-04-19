import { ApiProperty } from '@nestjs/swagger';

export class BaseApiResponse {
    @ApiProperty()
    statusCode: any;
    @ApiProperty()
    message: any;
}

export function SwaggerBaseApiResponse(type: any, description?: any): any {
    class ExtendedBaseApiResponse extends BaseApiResponse {
    }
    __decorate([
        ApiProperty({ type, description }),
        __metadata("design:type", Object)
    ], ExtendedBaseApiResponse.prototype, "data", void 0);
    const isAnArray = Array.isArray(type) ? ' [ ] ' : '';
    Object.defineProperty(ExtendedBaseApiResponse, 'name', {
        value: `SwaggerBaseApiResponseFor ${type} ${isAnArray}`,
    });
    return ExtendedBaseApiResponse;
}
