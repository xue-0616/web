import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProviderType } from '../../entities/accounts.entity';

export class AuthAccountInfoInput {
    @ApiProperty({
        enum: ProviderType,
        enumName: 'ProviderType',
    })
    @IsEnum(ProviderType)
    provider: any;
    @ApiProperty({
        type: String,
        description: 'google or aws access_token',
    })
    @IsString()
    @IsNotEmpty()
    accessToken: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    source: any;
}
