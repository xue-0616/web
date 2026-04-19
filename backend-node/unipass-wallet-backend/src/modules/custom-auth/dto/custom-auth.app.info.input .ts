import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

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
}
