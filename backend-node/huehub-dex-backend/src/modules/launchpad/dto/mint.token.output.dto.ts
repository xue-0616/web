import { ApiProperty } from '@nestjs/swagger';

export enum MintStatus {
    Pending = 0,
    Completed = 1,
    Failed = 2,
}

export class MintOutputDto {
    @ApiProperty({
        enum: MintStatus,
        example: MintStatus.Pending,
        description: 'mint tx status:0:Pending,1:Completed,2:Failed',
    })
    status: MintStatus;
    @ApiProperty({
        type: String,
        example: 'ba...',
        description: 'btc tx hash',
    })
    btcTransactionHash: string;
}
