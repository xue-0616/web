import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Decimal from 'decimal.js';

export enum MintTransactionStatus {
    CannotMint = 0,
    CanMint = 1,
    Minted = 2,
}

export class MintCheckOutputDto {
    @ApiProperty({
        enum: MintTransactionStatus,
        example: MintTransactionStatus.CanMint,
        description: 'mint tx status:0:CannotMint,1:CanMint,2:Minted',
    })
    mintStatus: MintTransactionStatus;
    @ApiPropertyOptional({
        type: String,
    })
    paymasterAddress: string;
    @ApiPropertyOptional({
        type: Number,
    })
    mintFee: number;
    @ApiProperty({
        type: Number,
        description: 'mint ckb cost',
        required: true,
    })
    ckbCellCost: number;
    @ApiPropertyOptional({
        type: String,
        example: '100000',
        description: 'minted asset amount',
    })
    amountPerMint: Decimal;
    @ApiPropertyOptional({
        type: String,
    })
    paymentAddress: string;
    @ApiPropertyOptional({
        type: Number,
    })
    paymentAmount: number;
}
