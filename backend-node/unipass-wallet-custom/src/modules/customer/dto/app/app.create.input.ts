import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AppCreateInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    appName: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    appId: any;
    @ApiPropertyOptional({
        type: Boolean,
    })
    @IsBoolean()
    @IsOptional()
    enableCustomPolicy: any;
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
}
