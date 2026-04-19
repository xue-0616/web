// Recovered from dist/otp.output.dto.js.map (source: ../../../../src/modules/otp/dtos/otp.output.dto.ts)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyCodeOutput {
    @ApiProperty({ type: String, description: 'up auth token' })
    upAuthToken!: string;
}

export class SendCodeOutput {
    @ApiPropertyOptional({ type: Boolean, description: 'is Showre google reCaptcha' })
    isShowReCaptcha?: boolean;
}

export class VerifyGuardianDataOutput {
    @ApiProperty({ type: Boolean, description: 'guardian email is verified' })
    verified!: boolean;

    @ApiProperty({ type: String, description: 'up auth token bind email address' })
    email!: string;
}
