import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNotEmptyObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemPSBTInputDto {
    @ApiProperty({
        type: [Number],
        description: 'rgn++ items id',
        required: true,
    })
    @IsNotEmpty()
    itemIds!: number[];
}

export class Output {
    @ApiProperty({
        type: String,
        description: 'psbt output',
        required: true,
    })
    @IsNotEmpty()
    address!: string;
    @ApiProperty({
        type: Number,
        description: 'psbt value',
        required: true,
    })
    @IsNotEmpty()
    value!: bigint;
}

export class CKBTransaction {
    @ApiProperty({
        type: [String],
        description: 'rgn++ rgbpp lock args list',
        required: true,
    })
    @IsArray()
    rgbppLockArgsList!: string[];
    @ApiProperty({
        type: String,
        description: 'rgn++ ckb transfer amount',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    transferAmount!: string;
}

export class BuyItemsInputDto {
    @ApiProperty({
        type: [Number],
        description: 'rgn++ items id list',
        required: true,
    })
    @IsNotEmpty()
    itemIds!: number[];
    @ApiProperty({
        type: String,
        description: 'rgn++ marketFee',
        required: true,
    })
    @IsNotEmpty()
    marketFee!: string;
    @ApiProperty({
        type: String,
        description: 'rgn++ transaction fee',
        required: true,
    })
    @IsNotEmpty()
    transactionFee!: string;
    @ApiProperty({
        type: String,
        description: 'rgn++ btc sign tx',
        required: true,
    })
    @IsNotEmpty()
    @IsString()
    signedBTCTransaction!: string;
    @ApiProperty({
        type: CKBTransaction,
        description: 'rgn++ transaction fee',
        required: true,
    })
    @IsNotEmptyObject()
    @ValidateNested({ each: true })
    @Type(() => CKBTransaction)
    rgbppCKBTransaction!: CKBTransaction;
}
