import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

export class BaseApiResponse<T> {
    data!: T;
    @ApiProperty({
        description: '200:success;4000:parameter exception 4001:Item invalid;4002:Service fee not match;4003:Psbt not match;4004:Ckb tx not match;4005:Signature error,4006:Item is existing',
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
