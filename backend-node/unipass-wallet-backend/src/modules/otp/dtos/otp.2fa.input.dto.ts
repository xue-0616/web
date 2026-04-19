import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { SendOtpCodeInput, VerifyOtpCodeInput } from './otp.input.dto';
import { BindAuthPhone } from './otp.send.type.dto';
import { AuthType } from '../../account/entities';

export class Send2FaCodeInput extends SendOtpCodeInput {
    @ApiPropertyOptional({
        type: BindAuthPhone,
        description: 'when bind phone used object',
    })
    @IsOptional()
    bindPhone: any;
    @ApiPropertyOptional({
        type: Number,
        description: `send 2fa code type, email:${AuthType.Email}, phone ${AuthType.Phone}`,
        default: AuthType.Email,
    })
    @IsNumber()
    @IsOptional()
    authType: any;
    @ApiPropertyOptional({
        type: String,
        description: 'send 2fa google recaptcha response',
    })
    @IsString()
    @IsOptional()
    response: any;
}

export class VerifyOtp2FaCodeInput extends VerifyOtpCodeInput {
    @ApiPropertyOptional({
        type: Number,
        description: `send 2fa code type, email:${AuthType.Email}, phone ${AuthType.Phone}`,
        default: AuthType.Email,
    })
    @IsNumber()
    @IsOptional()
    authType: any;
}
