import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class Web3auth {
    @ApiProperty({
        type: String,
    })
    @IsString()
    address: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    sig: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    message: any;
}

export class CustomAuthLoginInput {
    @ApiProperty({
        type: Web3auth,
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
