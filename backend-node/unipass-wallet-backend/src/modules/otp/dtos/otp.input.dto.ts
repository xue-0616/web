import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum OtpAction {
    Login = "login",
    Auth2Fa = "auth2Fa",
    BindPhone = "bindPhone",
    SendGuardian = "sendGuardian",
    PasswordLogin = "passwordLogin",
}

export class SendOtpCodeInput {
    @ApiProperty({
        enum: OtpAction,
        enumName: 'OtpAction',
        description: 'send code type',
        required: true,
    })
    @IsEnum(OtpAction, {
        message: 'action invalid， need in array [bindPhone,auth2Fa]',
    })
    action: any;
}

export class VerifyOtpCodeInput {
    @ApiProperty({
        enum: OtpAction,
        enumName: 'OtpAction',
        description: 'send code type',
    })
    @IsEnum(OtpAction, {
        message: 'action invalid， need in array [bindPhone,bindGA,signUp,signIn,startRecoveryEmail]',
    })
    action: any;
    @ApiProperty({
        type: String,
        description: 'otp code',
    })
    @IsNotEmpty()
    code: any;
}
