import { ApiProperty } from '@nestjs/swagger';

export class PasswordTokenOutput {
    @ApiProperty({
        type: String,
        description: 'upAuthToken',
    })
    upAuthToken: any;
    @ApiProperty({
        type: String,
        description: 'account address',
    })
    address: any;
    @ApiProperty({
        type: Boolean,
        description: 'show google Graphic verification code',
    })
    showCaptcha: any;
    @ApiProperty({
        type: Boolean,
        description: 'show password is pending key',
    })
    pending: any;
}
