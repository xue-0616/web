import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpAuthToken {
    @ApiProperty({
        type: String,
        description: 'auth token bind email address',
    })
    @IsEmail()
    email: any;
    @ApiProperty({
        type: String,
        description: 'email bind jwt token',
    })
    @IsString()
    @IsNotEmpty()
    upAuthToken: any;
}
