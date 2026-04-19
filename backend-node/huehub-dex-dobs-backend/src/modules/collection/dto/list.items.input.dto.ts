import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsNotEmpty, IsNumber, IsString, Validate, ValidateNested } from 'class-validator';
import { TypeHashValidator } from '../../../common/utils/typehash.validator';
import { Transform, Type } from 'class-transformer';
import Decimal from 'decimal.js';

export class ListItemInput {
    @ApiProperty({
        type: String,
        description: 'collection type hash',
    })
    @IsString()
    @Validate(TypeHashValidator)
    clusterTypeHash!: string;
    @ApiProperty({
        type: String,
        description: 'btc utxo hash',
    })
    @IsString()
    @IsNotEmpty()
    txHash!: string;
    @ApiProperty({
        type: Number,
        description: 'btc utxo index',
    })
    @IsNumber()
    @IsNotEmpty()
    index!: number;
    @ApiProperty({
        type: String,
        description: 'ckb spore spore args',
    })
    @IsString()
    @IsNotEmpty()
    sporeArgs!: string;
    @ApiProperty({
        type: String,
        description: 'ckb spore spore type hash',
    })
    @IsString()
    @IsNotEmpty()
    sporeTypeHash!: string;
    @ApiProperty({
        type: String,
        description: 'sell btc price uit satoshi',
    })
    @IsNotEmpty()
    @Transform(({ value }) => new Decimal(value))
    price!: Decimal;
    @ApiProperty({
        type: String,
        description: 'btc psbt string',
    })
    @IsString()
    psbt!: string;
    @ApiProperty({
        type: String,
        description: 'btc psbt sig',
    })
    @IsString()
    @IsNotEmpty()
    psbtSig!: string;
}

export class ListItemsInputDto {
    @ApiProperty({
        type: [ListItemInput],
        description: 'sell dobs btc amount',
    })
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => ListItemInput)
    items!: ListItemInput[];
}
