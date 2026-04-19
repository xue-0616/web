import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SnapshotTokenInfo {
    @ApiProperty({
        type: String,
    })
    xudtTypeHash!: string;
    @ApiProperty({
        type: String,
    })
    holders!: string;
    @ApiProperty({
        type: Number,
    })
    decimal!: number;
    @ApiProperty({
        type: String,
    })
    symbol!: string;
    @ApiProperty({
        type: String,
    })
    name!: string;
    @ApiPropertyOptional({
        type: String,
    })
    icon!: string;
}

export class SnapshotTokenListInfo {
    @ApiProperty({
        type: String,
    })
    address!: string;
    @ApiProperty({
        type: String,
    })
    amount!: string;
}

export class SnapshotOutputDto {
    @ApiProperty({
        type: Number,
    })
    btcBlockHeight!: number;
    @ApiProperty({
        type: Number,
    })
    ckbBlockHeight!: number;
    @ApiProperty({
        type: SnapshotTokenInfo,
    })
    tokenInfo!: SnapshotTokenInfo;
    @ApiProperty({
        type: [SnapshotTokenListInfo],
    })
    list!: SnapshotTokenListInfo[];
}
