import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Decimal from 'decimal.js';

export class TokenInfoDto {
    @ApiProperty({
        type: Number,
        description: 'token id',
    })
    id!: number;
    @ApiProperty({
        type: String,
        description: 'token url',
    })
    iconUrl!: string;
    @ApiProperty({
        type: String,
        description: 'token name',
    })
    name!: string;
    @ApiProperty({
        type: String,
        description: 'token symbol',
    })
    symbol!: string;
    @ApiProperty({
        type: String,
        description: 'xudt token type hash',
    })
    xudtTypeHash!: string;
    @ApiProperty({
        enum: String,
        description: 'xudt args',
    })
    xudtArgs!: string;
    @ApiProperty({
        enum: String,
        description: 'xudt code hash',
    })
    xudtCodeHash!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ mint progress rate',
    })
    progressRate!: Decimal;
    @ApiProperty({
        type: Boolean,
        description: 'rgb++ show mint button',
    })
    showMintButton!: boolean;
    @ApiProperty({
        type: String,
        description: 'rgb++ total supply',
    })
    supply!: string;
    @ApiPropertyOptional({
        type: Number,
        description: 'rgb++ mint start block',
    })
    startBlock!: number;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ current mint amount',
    })
    mintedAmount!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ token issued at',
    })
    issuedAt!: number;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ deploy paymaster address',
    })
    paymasterAddress!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'token floor price in Satoshi / token',
    })
    price!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'token usd price',
    })
    usdPrice!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ usd price',
    })
    change!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ volume in Satoshi',
    })
    volume!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ usd volume',
    })
    usdVolume!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ market cap in Satoshi',
    })
    marketCap!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ usd market cap',
    })
    usdMarketCap!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ holders number',
    })
    holders!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ holders changer',
    })
    holdersChange!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ sales changer',
    })
    sales!: string;
    @ApiProperty({
        type: Number,
        description: 'rgb++ token decimal',
    })
    tokenDecimal!: number;
    @ApiProperty({
        type: Number,
        description: 'locked btc age, value = locked amount * locked blocks',
    })
    lockedBtcAge!: number;
    @ApiProperty({
        type: [Number],
        description: 'allowed locked btc amounts 0:blue amount,1:red amount unit: sat.',
    })
    lockedBtcAmounts!: number[];
    @ApiProperty({
        type: Number,
        description: 'mint ckb cost',
        required: true,
    })
    ckbCellCost!: number;
    @ApiProperty({
        type: Number,
        description: 'mint fee',
        required: true,
    })
    mintFee!: number;
    @ApiProperty({
        type: Number,
        description: 'pre mint amount',
        required: true,
    })
    perMintAmount!: number;
}

export class TokensOutputDto {
    @ApiProperty({
        type: [TokenInfoDto],
        description: 'rgb++ sales changer',
    })
    tokenList!: TokenInfoDto[];
}
