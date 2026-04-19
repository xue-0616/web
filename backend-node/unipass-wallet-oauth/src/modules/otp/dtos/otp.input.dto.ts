// Recovered from dist/otp.input.dto.js.map (source: ../../../../src/modules/otp/dtos/otp.input.dto.ts)

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum OtpAction {
    bindPhone = 'bindPhone',
    auth2Fa = 'auth2Fa',
    signUp = 'signUp',
    signIn = 'signIn',
    sendRecoveryEmail = 'sendRecoveryEmail',
    startRecoveryEmail = 'startRecoveryEmail',
    bindGA = 'bindGA',
}

export class SendOtpCodeInput {
    @ApiProperty({ enum: OtpAction, enumName: 'OtpAction', description: 'send code type', required: true })
    @IsEnum(OtpAction, { message: 'action invalid， need in array [bindPhone,auth2Fa,signUp,signIn,sendRecoveryEmail]' })
    action!: OtpAction;
}

export class VerifyOtpCodeInput {
    @ApiProperty({ enum: OtpAction, enumName: 'OtpAction', description: 'send code type' })
    @IsEnum(OtpAction, { message: 'action invalid， need in array [bindPhone,bindGA,signUp,signIn,startRecoveryEmail]' })
    action!: OtpAction;

    @ApiProperty({ type: String, description: 'otp code' })
    @IsNotEmpty()
    code!: string;
}
