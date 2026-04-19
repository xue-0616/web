import { ApiProperty } from '@nestjs/swagger';

export class OrderPendingDto {
    @ApiProperty({
        type: String,
    })
    buyerAddress!: string;
    @ApiProperty({
        type: String,
    })
    btcTxHash!: string;
    @ApiProperty({
        type: String,
    })
    createdAt!: Date;
    @ApiProperty({
        type: Number,
    })
    orderId!: number;
    @ApiProperty({
        type: [Number],
    })
    itemIds!: number[];
    @ApiProperty({
        type: String,
    })
    ckbTx!: string;
}

export class OrderPendingOutputDto {
    @ApiProperty({
        type: [OrderPendingDto],
    })
    list!: OrderPendingDto[];
    @ApiProperty({
        enum: Number,
    })
    total!: number;
}
