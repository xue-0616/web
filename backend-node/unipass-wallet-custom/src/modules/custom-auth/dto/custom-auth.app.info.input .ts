import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CustomAuthAdminAppInfoInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    appName: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    adminSig: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    timestamp: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    jwtVerifierIdKey: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    verifierName: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    web3authClientId: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    appId: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    jwtPubkey: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    appInfo: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    customPolicyPublicKey: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    callbackUrl: any;
    @ApiPropertyOptional({
        type: Boolean,
    })
    @IsBoolean()
    @IsOptional()
    enableCustomPolicy: any;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    @IsOptional()
    customerId: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    web3authEnv: any;
}
