import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendGuardianLinkInput {
    @ApiProperty({
        type: String,
        description: 'Email address to send guardian link',
    })
    @IsEmail()
    @IsNotEmpty()
    email: any;
}
