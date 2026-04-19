import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ItemInfo } from './items.output.dto';
import { ShowOrderType } from './my.orders.input.dto';

export class OrderInfo extends ItemInfo {
    @ApiProperty({
        enum: ShowOrderType,
        description: 'query order type enum,0:Listing,1:SoldOut,2:Bought,3:Unlist',
    })
    type!: ShowOrderType;
    @ApiProperty({
        enum: Number,
        description: 'order create timestamp unit Second',
    })
    createdTime!: number;
    @ApiProperty({
        enum: String,
        description: 'sellerAddress address',
    })
    from!: string;
    @ApiPropertyOptional({
        enum: String,
        description: 'buyerAddress address',
    })
    @IsOptional()
    to!: string;
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
}

export class MyOrdersOutput {
    @ApiProperty({
        type: [OrderInfo],
        description: 'my order list',
    })
    list!: OrderInfo[];
    @ApiProperty({
        enum: Number,
        description: 'total order number',
    })
    total!: number;
}
