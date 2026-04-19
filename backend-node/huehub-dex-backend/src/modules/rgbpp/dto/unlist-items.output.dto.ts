import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from './buy-items.output.dto';

export class UnlistItemsOutputDto {
    @ApiProperty({
        enum: OrderStatus,
        description: 'order status:0:Pending,1:Completed,2:Failed',
    })
    status!: OrderStatus;
    @ApiProperty({
        type: String,
        description: 'btc tx hash',
    })
    btcTransactionHash!: string;
}
