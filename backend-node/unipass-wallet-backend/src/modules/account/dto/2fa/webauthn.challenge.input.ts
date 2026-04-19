import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum WebAuthnAction {
    Register = "register",
    Login = "Login",
}

export class WebAuthnChallengeInput {
    @ApiProperty({
        enum: WebAuthnAction,
        enumName: 'WebAuthnAction',
    })
    @IsEnum(WebAuthnAction)
    action: any;
    @ApiProperty({
        type: String,
    })
    credentialID: any;
}
