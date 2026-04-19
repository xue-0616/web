import { ApiProperty } from '@nestjs/swagger';

export class GetNFTImageUrlOutput {
    @ApiProperty({
        type: String,
    })
    imageUrl: any;
    @ApiProperty({
        type: String,
    })
    openseaUrl: any;
    @ApiProperty({
        type: String,
    })
    name: any;
}
