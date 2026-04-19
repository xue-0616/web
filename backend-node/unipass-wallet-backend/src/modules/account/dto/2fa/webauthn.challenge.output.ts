import { ApiProperty } from '@nestjs/swagger';

export class WebAuthnChallengeOutput {
    @ApiProperty({
        type: String,
        description: '2fa webAuthn challenge',
    })
    challenge: any;
}

export class WebAuthnVerifyOutput {
    @ApiProperty({
        type: Boolean,
    })
    isVerified: any;
}
