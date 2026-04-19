import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export enum ApiMethod {
    POST = 0,
    Get = 1,
}

export class ForwardingApiInputDto {
    @ApiProperty({
        enum: ApiMethod,
        description: 'API method: 0 - POST, 1 - GET',
        example: ApiMethod.POST,
    })
    @IsEnum(ApiMethod)
    method!: ApiMethod;
    @ApiProperty({
        enum: String,
        description: 'url patch',
        example: '/auth/message',
    })
    @IsString()
    path!: String;
    @ApiProperty({
        enum: String,
        description: 'api request json string',
    })
    @IsString()
    body!: string;
}
