import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetNFTImageUrlInput {
    @ApiProperty({
        type: String,
        description: 'account address',
    })
    @IsString()
    @IsNotEmpty()
    address: any;
    @ApiProperty({
        type: String,
        description: 'nft contract address',
    })
    @IsString()
    @IsNotEmpty()
    contractAddress: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    chainId: any;
    @ApiPropertyOptional({
        type: String,
        description: 'account address',
    })
    @IsString()
    @IsOptional()
    tokenId: any;
}
