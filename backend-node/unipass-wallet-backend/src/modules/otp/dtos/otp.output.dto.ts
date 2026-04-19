import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyCodeOutput {
    @ApiProperty({
        type: String,
        description: 'up auth token',
    })
    upAuthToken: any;
}

export class SendCodeOutput {
    @ApiPropertyOptional({
        type: String,
        description: 'is Showre google reCaptcha',
    })
    isShowReCaptcha: any;
}

export class VerifyGuardianDataOutput {
    @ApiProperty({
        type: Boolean,
        description: 'guardian email is verified',
    })
    verified: any;
    @ApiProperty({
        type: String,
        description: 'up auth token bind email address',
    })
    email: any;
}
