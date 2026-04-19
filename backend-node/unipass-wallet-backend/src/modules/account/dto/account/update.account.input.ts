import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Auth2FaCodeToken } from '../2fa';

export class UpdateAccountPasswordInput {
    @ApiProperty({
        type: String,
        description: 'auth token bind email address',
    })
    @IsEmail()
    email: any;
    @ApiProperty({
        type: String,
        description: 'master key password',
    })
    @IsString()
    @IsNotEmpty()
    kdfPassword: any;
    @ApiProperty({
        type: [Auth2FaCodeToken],
        description: 'account login 2fa verify token',
    })
    @IsArray()
    auth2FaToken: any;
}
