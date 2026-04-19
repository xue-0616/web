import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ActivityType } from './activities.input.dto';
import { ShowItemLoadingStatus } from './items.output.dto';

export class ActivitiesOutput {
    @ApiProperty({
        enum: ActivityType,
        description: 'query order type enum,0:All,1:Sale,2:List,3:Transfer 4: Unlist',
    })
    type!: ActivityType;
    @ApiProperty({
        enum: Number,
        description: 'order create timestamp unit second',
    })
    createdTime!: number;
    @ApiPropertyOptional({
        enum: String,
        description: 'order btc tx hash',
    })
    @IsOptional()
    btcTxHash!: string | null;
    @ApiPropertyOptional({
        enum: String,
        description: 'order ckb tx hash',
    })
    @IsOptional()
    ckbTxHash!: string | null;
    @ApiProperty({
        type: Number,
        description: 'item id',
    })
    id!: number;
    @ApiProperty({
        type: String,
        description: 'seller address',
    })
    from!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'buyer address',
    })
    to!: string | null;
    @ApiProperty({
        type: String,
        description: 'rgb++ token name',
    })
    name!: string;
    @ApiProperty({
        type: String,
        description: 'rgb++ token symbol',
    })
    symbol!: string;
    @ApiProperty({
        type: String,
        description: 'sell rgb++ token amount token minimum precision for',
    })
    tokenAmount!: string;
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
        description: '0:Displaying loading 1:Do not display loading',
    })
    status!: ShowItemLoadingStatus;
}

export class ActivitiesOutputDto {
    @ApiProperty({
        type: [ActivitiesOutput],
        description: 'my order list',
    })
    list!: ActivitiesOutput[];
    @ApiProperty({
        enum: Number,
        description: 'total order number',
    })
    total!: number;
}
