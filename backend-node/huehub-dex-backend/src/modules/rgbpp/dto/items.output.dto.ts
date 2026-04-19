import { ApiProperty } from '@nestjs/swagger';
import Decimal from 'decimal.js';

export enum ShowItemLoadingStatus {
    Loading = 0,
    Complete = 1,
}

export class ItemInfo {
    @ApiProperty({
        type: Number,
        description: 'item id',
    })
    id!: number;
    @ApiProperty({
        type: String,
        description: 'seller address',
    })
    sellerAddress!: string;
    @ApiProperty({
        type: String,
        description: 'rgb++ utxo tx hash',
    })
    txHash!: string;
    @ApiProperty({
        type: Number,
        description: 'rgb++ utxo index',
    })
    index!: number;
    @ApiProperty({
        type: Number,
        description: 'utxo btc value',
    })
    btcValue!: Decimal;
    @ApiProperty({
        type: String,
        description: 'rgb++ token name',
    })
    name!: string;
    @ApiProperty({
        type: String,
        description: 'token symbol',
    })
    symbol!: string;
    @ApiProperty({
        type: String,
        description: 'sell rgb++ token amount token minimum precision for',
    })
    tokenAmount!: string;
    @ApiProperty({
        type: String,
        description: 'rgbpp type code hash',
    })
    xudtCodeHash!: string;
    @ApiProperty({
        type: String,
        description: 'rgbpp type args',
    })
    xudtArgs!: string;
    @ApiProperty({
        type: String,
        description: 'The btc price of selling a single rgb++ token in Satoshi / token',
    })
    pricePerToken!: string;
    @ApiProperty({
        type: String,
        description: 'The btc price of selling a single rgb++ token in USD',
    })
    usdPricePerToken!: string;
    @ApiProperty({
        type: String,
        description: 'sell rgb++ btc amount Satoshi',
    })
    totalPrice!: string;
    @ApiProperty({
        type: Number,
        description: 'sell rgb++ token decimal',
    })
    tokenDecimal!: number;
    @ApiProperty({
        type: String,
        description: 'Total USD price of sale',
    })
    totalUsdPrice!: string;
    @ApiProperty({
        enum: ShowItemLoadingStatus,
        description: '0:Pending 1:Complete',
    })
    status!: ShowItemLoadingStatus;
}

export class ItemListOutputDto {
    @ApiProperty({
        type: [ItemInfo],
        description: 'item list',
    })
    list!: ItemInfo[];
    @ApiProperty({
        type: Number,
        description: 'item total length',
    })
    total!: number;
}
