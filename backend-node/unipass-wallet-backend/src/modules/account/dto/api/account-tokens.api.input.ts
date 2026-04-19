import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetAccountTokensInput {
    @ApiProperty({
        type: (Array),
        description: 'chain id list',
    })
    @IsArray()
    chainIds: any;
    @ApiProperty({
        type: String,
        description: 'account address',
    })
    @IsString()
    @IsNotEmpty()
    address: any;
}

export class GetNFTInput {
    @ApiProperty({
        type: String,
        description: 'account address',
    })
    @IsString()
    @IsNotEmpty()
    address: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    chainId: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    page: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    limit: any;
}

export class GetNFTTokenInput extends GetNFTInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    contractAddress: any;
}
