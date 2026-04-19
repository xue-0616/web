import { ApiProperty } from '@nestjs/swagger';

export enum ShowOrderStatus {
    Pending = 0,
    Completed = 1,
    Failed = 2,
}

export class ItemPSBT {
    @ApiProperty({
        type: Number,
        description: 'items id',
    })
    itemId!: number;
    @ApiProperty({
        type: String,
        description: 'Unsigned PSBT',
    })
    psbt!: string;
}

export class ItemPSBTOutputDto {
    @ApiProperty({
        type: [ItemPSBT],
        description: 'dobs items id',
    })
    psbts!: ItemPSBT[];
    @ApiProperty({
        type: String,
        description: 'receive service fee btc address',
    })
    feeAddress!: string;
    @ApiProperty({
        type: String,
        description: 'service fee rate',
    })
    feeRate!: string;
    @ApiProperty({
        type: String,
    })
    minServiceFee!: string;
}

export class BuyItemsOutputDto {
    @ApiProperty({
        enum: ShowOrderStatus,
        description: 'order status:0:Pending,1:Completed,2:Failed',
    })
    status!: ShowOrderStatus;
    @ApiProperty({
        type: String,
        description: 'btc tx hash',
    })
    btcTransactionHash!: string;
}
