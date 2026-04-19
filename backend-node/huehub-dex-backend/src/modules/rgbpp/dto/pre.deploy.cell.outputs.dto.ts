import { ApiProperty } from '@nestjs/swagger';
import { IndexerCell } from '@rgbpp-sdk/ckb';

export class PreDeployOutputDto {
    @ApiProperty({
        type: Object,
        description: 'index cell object',
    })
    cell!: IndexerCell;
    @ApiProperty({
        type: String,
        description: 'mint paymaster address',
        required: true,
    })
    paymasterAddress!: string;
    @ApiProperty({
        type: Number,
        description: 'deploy fee',
        required: true,
    })
    deployFee!: number;
    @ApiProperty({
        type: String,
        description: 'distributor Time Lock ckb Address',
        required: true,
    })
    distributorTimeLockAddress!: string;
    @ApiProperty({
        type: String,
        description: 'deploy data id',
        required: true,
    })
    id!: string;
    @ApiProperty({
        type: String,
        description: 'utxo tx hash',
        required: true,
    })
    txHash!: string;
    @ApiProperty({
        type: Number,
        description: 'utxo  id',
        required: true,
    })
    index!: number;
    @ApiProperty({
        type: Number,
        description: 'utxo  value',
        required: true,
    })
    value!: number;
}
