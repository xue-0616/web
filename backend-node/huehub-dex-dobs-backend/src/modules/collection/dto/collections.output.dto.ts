import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Decimal from 'decimal.js';

export class CollectionInfoDto {
    @ApiProperty({
        type: Number,
        description: 'collection id',
    })
    id!: number;
    @ApiProperty({
        type: String,
        description: 'collection url',
    })
    iconUrl!: string;
    @ApiProperty({
        type: String,
        description: 'collection name',
    })
    name!: string;
    @ApiProperty({
        type: String,
        description: 'collection type hash',
    })
    clusterTypeHash!: string;
    @ApiProperty({
        enum: String,
        description: 'collection args',
    })
    clusterTypeArgs!: string;
    @ApiProperty({
        type: String,
        description: 'dobs total supply',
    })
    supply!: Decimal;
    @ApiPropertyOptional({
        type: String,
        description: 'The btc price, unit Satoshi / nft',
    })
    price!: Decimal;
    @ApiPropertyOptional({
        type: String,
        description: 'The btc price in USD',
    })
    usdPrice!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs usd price',
    })
    change!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs volume in Satoshi',
    })
    volume!: Decimal;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs usd volume',
    })
    usdVolume!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs market cap in Satoshi',
    })
    marketCap!: Decimal;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs usd market cap',
    })
    usdMarketCap!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs holders number',
    })
    holders!: Decimal;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs holders changer',
    })
    holdersChange!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs sales changer',
    })
    sales!: Decimal;
    @ApiProperty({
        type: Number,
        description: 'dobs nft decimal',
    })
    decimal!: number;
}

export class CollectionOutputDto {
    @ApiProperty({
        type: [CollectionInfoDto],
        description: 'dobs sales changer',
    })
    list!: CollectionInfoDto[];
}
