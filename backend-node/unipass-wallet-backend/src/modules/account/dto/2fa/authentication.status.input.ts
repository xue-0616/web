import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber } from 'class-validator';
import { AuthType } from '../../entities';

export class AuthenticatorStatusInput {
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
        type: Number,
        description: '2fa status 0:close,1:open',
        default: {},
        required: true,
    })
    @IsNumber()
    status: any;
}
