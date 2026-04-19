import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatorStatusOutput {
    @ApiProperty({
        type: Number,
        description: '2fa status(number) 0:close,1:open',
        default: {},
        required: true,
    })
    status: any;
}
