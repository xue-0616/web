import { ApiProperty } from '@nestjs/swagger';

export class GetMintOutput {
    @ApiProperty({ type: String })
    contractAddress: any;
    @ApiProperty({ type: String })
    signature: any;
    @ApiProperty({ type: Number })
    nftIndex: any;
}

export class GetShortKeyOutput {
    @ApiProperty({ type: String })
    shortKey: any;
}

export class GetShortKeyClaimOutput {
    @ApiProperty({ type: String })
    sender: any;
    @ApiProperty({ type: String })
    tokenId: any;
    @ApiProperty({ type: String })
    deadline: any;
    @ApiProperty({ type: String })
    signature: any;
    @ApiProperty({ type: String })
    contractAddress: any;
}
