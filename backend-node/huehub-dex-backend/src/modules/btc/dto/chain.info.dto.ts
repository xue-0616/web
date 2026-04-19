import { ApiProperty } from '@nestjs/swagger';
import Decimal from 'decimal.js';

export class BtcGasFeeInfo {
    @ApiProperty({
        type: Number,
        description: 'Slow Gas Fee',
        required: true,
    })
    slow!: number;
    @ApiProperty({
        type: Number,
        description: 'General Gas Fee',
        required: true,
    })
    standard!: number;
    @ApiProperty({
        type: Number,
        description: 'Speed Gas Fee',
        required: true,
    })
    fast!: number;
}

export class BtcChainInfoOutput {
    @ApiProperty({
        type: BtcGasFeeInfo,
        description: 'The nonce string that requires a signature',
        required: true,
    })
    gas!: BtcGasFeeInfo;
    @ApiProperty({
        type: Number,
        description: 'Current fiat currency price',
        required: true,
    })
    usdPrice!: number;
    @ApiProperty({
        type: Number,
        description: 'Current block height',
        required: true,
    })
    blockHeight!: number;
    @ApiProperty({
        type: String,
        description: 'Paymaster balance',
        required: true,
    })
    paymasterBalance!: Decimal;
}
