import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NFTCollection {
    @ApiProperty({
        type: String,
    })
    contractAddress: any;
    @ApiProperty({
        type: String,
    })
    tokenType: any;
    @ApiProperty({
        type: Number,
    })
    totalTokens: any;
    @ApiPropertyOptional({
        type: String,
    })
    name: any;
    @ApiProperty({
        type: String,
    })
    symbol: any;
    @ApiPropertyOptional({
        type: String,
    })
    imageUrl: any;
    @ApiPropertyOptional({
        type: String,
    })
    chainId: any;
    @ApiPropertyOptional({
        type: String,
    })
    openseaUrl: any;
    @ApiProperty({
        type: String,
    })
    browserUrl: any;
    @ApiPropertyOptional({
        type: String,
    })
    timeLastUpdated: any;
}

export class GetNFTCollectionOutput {
    @ApiProperty({
        type: (Array),
    })
    list: any;
    @ApiProperty({
        type: Number,
    })
    total: any;
}
