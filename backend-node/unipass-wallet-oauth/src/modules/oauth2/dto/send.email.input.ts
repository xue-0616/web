// Recovered from dist/send.email.input.js.map (source: ../../../../src/modules/oauth2/dto/send.email.input.ts)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class AuthParams {
    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    response_type?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    redirect_uri?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    state?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    nonce?: string;

    @ApiProperty({ type: String })
    @IsString()
    ui_locales!: string;
}

export class SendEmailCodeInput {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    email!: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    action?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    client_id?: string;

    @ApiPropertyOptional({ type: AuthParams })
    @IsObject()
    @IsOptional()
    authParams?: AuthParams;

    @ApiPropertyOptional({ type: String, description: 'send google recaptcha response' })
    @IsString()
    @IsOptional()
    response?: string;
}

export class VerifyEmailCodeInput {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    email!: string;

    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    code!: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    action?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    client_id?: string;
}
