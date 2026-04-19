import { ApiProperty } from '@nestjs/swagger';
import { ShowOrderStatus } from './buy.items.output.dto';

export class UnlistItemsOutputDto {
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
