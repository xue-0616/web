// Recovered from dist/client.input.js.map (source: ../../../../src/modules/oauth2/dto/client.input.ts)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum OAuth2Action {
    Login = 'login',
}

export class ClientInput {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    resourceIds!: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    clientId?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    emailTemplate?: string;

    @ApiPropertyOptional({ type: String, description: '2fa oauth', default: '' })
    @IsString()
    @IsOptional()
    webServerRedirectUri?: string;
}

export class AuthorizeInput {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    client_id!: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    login_hint?: string;

    @ApiProperty({ type: String })
    @IsString()
    ui_locales!: string;

    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    response_type!: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    prompt?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    response?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    redirect_uri?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    nonce?: string;

    @ApiProperty({ type: String })
    @IsString()
    scope!: string;

    @ApiProperty({ type: String })
    @IsString()
    state!: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    auth0Client?: string;
}

export class AuthTokenInput {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    code!: string;

    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    grant_type!: string;

    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    redirect_uri!: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    client_id?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    client_secret?: string;

    @ApiPropertyOptional({ type: String })
    @IsString()
    @IsOptional()
    scope?: string;
}
