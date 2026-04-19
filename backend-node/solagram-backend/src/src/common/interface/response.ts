import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export class BaseApiResponse<T> {
    data!: T;
    @ApiProperty({
        description: '200:success;\n 4000:parameter exception,\n 4001: auth hash error \n 4002: message not find.\n ',
    })
    code!: number;
    @ApiProperty()
    message!: string;
}

export function SwaggerBaseApiResponse<T extends Type | undefined>(type: T, description?: string): any {
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
