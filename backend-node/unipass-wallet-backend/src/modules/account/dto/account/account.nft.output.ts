import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NFTToken {
    @ApiProperty({
        type: String,
    })
    tokenId: any;
    @ApiProperty({
        type: String,
    })
    tokenType: any;
    @ApiProperty({
        type: String,
    })
    timeLastUpdated: any;
    @ApiProperty({
        type: Number,
    })
    total: any;
    @ApiPropertyOptional({
        type: String,
    })
    title: any;
    @ApiPropertyOptional({
        type: String,
    })
    description: any;
    @ApiPropertyOptional({
        type: String,
    })
    imageUrl: any;
    @ApiPropertyOptional({
        type: String,
    })
    imageOriginalUrl: any;
}

export class GetNFTOutput {
    @ApiProperty({
        type: NFTToken,
    })
    list: any;
    @ApiProperty({
        type: Number,
    })
    total: any;
}
