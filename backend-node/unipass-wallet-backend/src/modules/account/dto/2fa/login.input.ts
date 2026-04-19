import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AuthType } from '../../entities';

export class Auth2FaCodeToken {
    @ApiProperty({
        enum: AuthType,
        enumName: 'AuthType',
        description: '2fa type',
    })
    @IsEnum(AuthType, {
        message: 'action invalid， need in array [0,1,2,3]',
    })
    type: any;
    @ApiProperty({
        type: String,
        description: '2fa verify token',
    })
    @IsString()
    @IsNotEmpty()
    upAuthToken: any;
}
