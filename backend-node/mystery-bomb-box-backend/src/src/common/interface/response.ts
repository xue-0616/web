import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export class BaseApiResponse<T> {
    data!: T;
    @ApiProperty({
        description: '200:success;4000:parameter exception',
    })
    code!: number;
    @ApiProperty()
    message!: string;
}

export function SwaggerBaseApiResponse<T extends Type>(type: T, description?: string): any {
    class ExtendedBaseApiResponse extends BaseApiResponse<any> {
        @ApiProperty({ type, description })
        declare data: any;
    }
    const isAnArray = Array.isArray(type) ? ' [ ] ' : '';
    Object.defineProperty(ExtendedBaseApiResponse, 'name', {
        value: `SwaggerBaseApiResponseFor ${type} ${isAnArray}`,
    });
    return ExtendedBaseApiResponse;
}
