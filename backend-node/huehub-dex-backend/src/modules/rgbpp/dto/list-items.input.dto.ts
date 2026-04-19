import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { String } from 'bitcoinjs-lib/src/types';

export class ListItemInput {
    @ApiProperty({
        type: Number,
        description: 'rgb++ token id',
    })
    @IsNumber()
    @IsNotEmpty()
    tokenId!: number;
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
        description: 'sell rgb++ token amount ',
    })
    @IsString()
    @IsNotEmpty()
    amount!: string;
    @ApiProperty({
        type: String,
        description: 'sell btc price uit satoshi',
    })
    @IsString()
    @IsNotEmpty()
    price!: string;
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
        type: String,
        description: 'sell rgb++ btc amount',
    })
    @IsNotEmpty()
    address!: string;
    @ApiProperty({
        type: [ListItemInput],
        description: 'sell rgb++ btc amount',
    })
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => ListItemInput)
    items!: ListItemInput[];
}
