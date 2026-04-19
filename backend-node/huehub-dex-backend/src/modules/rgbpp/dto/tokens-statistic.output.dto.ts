import { ApiProperty } from '@nestjs/swagger';
import Decimal from 'decimal.js';

export class TokenStatisticInfo {
    @ApiProperty({
        type: String,
        description: 'token floor price in Satoshi / token',
    })
    price!: Decimal;
    @ApiProperty({
        type: String,
        description: 'rgb++ volume in Satoshi',
    })
    volume!: Decimal;
    @ApiProperty({
        type: Number,
        description: 'token statistic time unit second',
    })
    time!: number;
}

export class TokensStatisticOutputDto {
    @ApiProperty({
        type: [TokenStatisticInfo],
        description: 'token statistic list',
    })
    tokenList!: TokenStatisticInfo[];
    @ApiProperty({
        type: Number,
        description: 'total length',
    })
    total!: number;
}
