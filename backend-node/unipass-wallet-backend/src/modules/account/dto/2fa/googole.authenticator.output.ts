import { ApiProperty } from '@nestjs/swagger';

export class GetGoogleAuthenticatorQRCodeOutput {
    @ApiProperty({
        type: String,
        description: 'google authentication qr code',
    })
    qrPath: any;
    @ApiProperty({
        type: String,
        description: 'google authentication qr secret',
    })
    secret: any;
}
