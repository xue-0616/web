import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
        description: 'dobs utxo tx hash',
    })
    txHash!: string;
    @ApiProperty({
        type: Number,
        description: 'dobs utxo index',
    })
    index!: number;
    @ApiProperty({
        type: Number,
        description: 'utxo btc value',
    })
    btcValue!: Decimal;
    @ApiProperty({
        type: String,
        description: 'dobs collections name',
    })
    name!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'spore prevBg base64  data',
    })
    prevBg!: string | null;
    @ApiPropertyOptional({
        type: String,
        description: 'spore prev.bgcolor',
    })
    prevBgColor!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'spore prev.type',
    })
    prevType!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'spore dobId',
    })
    dobId!: string;
    @ApiProperty({
        type: String,
        description: 'rgbpp spore type args',
    })
    sporeArgs!: string;
    @ApiProperty({
        type: String,
        description: 'rgbpp spore type hash',
    })
    sporeTypeHash!: string;
    @ApiProperty({
        type: String,
        description: 'The btc price, unit Satoshi / nft',
    })
    price!: Decimal;
    @ApiProperty({
        type: String,
        description: 'The btc price in USD',
    })
    usdPrice!: string;
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
