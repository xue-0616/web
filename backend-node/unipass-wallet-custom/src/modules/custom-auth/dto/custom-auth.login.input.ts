import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { Web3AuthSignature } from './custom-auth.register.input';

export class CustomAuthLoginInput {
    @ApiProperty({
        type: Web3AuthSignature,
    })
    @IsObject()
    web3auth: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    appId: any;
    @ApiPropertyOptional({
        type: String,
        default: '30d',
    })
    @IsString()
    @IsOptional()
    expirationInterval: any;
}
