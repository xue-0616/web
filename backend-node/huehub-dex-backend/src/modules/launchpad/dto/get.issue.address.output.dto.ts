import { ApiProperty } from '@nestjs/swagger';

export class IssueAddress {
    @ApiProperty({
        type: String,
    })
    address: string;
    @ApiProperty({
        type: String,
    })
    mintTxHash: string;
    @ApiProperty({
        type: Number,
    })
    amountPerMint: number;
}

export class LaunchpadToken {
    @ApiProperty({
        type: String,
    })
    xudtTypeHash: string;
    @ApiProperty({
        type: String,
    })
    xudtArgs: string;
    @ApiProperty({
        type: [IssueAddress],
    })
    addresses: IssueAddress[];
}

export class GetIssueAddressOutputDto {
    @ApiProperty({
        type: [LaunchpadToken],
    })
    list: LaunchpadToken[];
    @ApiProperty({
        type: Number,
    })
    total: number;
}
