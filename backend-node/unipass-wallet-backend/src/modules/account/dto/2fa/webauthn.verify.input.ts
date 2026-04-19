import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class ClientExtensionResults {
    @ApiPropertyOptional({
        type: Boolean,
    })
    @IsBoolean()
    appid: any;
    @ApiPropertyOptional({
        type: Object,
    })
    @IsObject()
    credProps: any;
    @ApiPropertyOptional({
        type: Boolean,
    })
    @IsBoolean()
    hmacCreateSecret: any;
}

export class WebauthnResponse {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    clientDataJSON: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    attestationObject: any;
    @ApiProperty({
        type: (Array),
        default: ['internal'],
    })
    @IsString()
    @IsNotEmpty()
    transports: any;
}

export class WebauthnVerifyInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    id: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    rawId: any;
    @ApiProperty({
        type: String,
        default: 'public-key',
    })
    @IsString()
    @IsNotEmpty()
    type: any;
    @ApiPropertyOptional({
        type: String,
        default: 'platform',
    })
    @IsString()
    @IsNotEmpty()
    authenticatorAttachment: any;
    @ApiPropertyOptional({
        type: ClientExtensionResults,
    })
    @IsObject()
    clientExtensionResults: any;
}
