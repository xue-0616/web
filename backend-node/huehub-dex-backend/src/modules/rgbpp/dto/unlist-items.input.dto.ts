import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNotEmptyObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CKBTransaction } from './buy-items.input.dto';

export class UnlistItemsInputDto {
    @ApiProperty({
        type: [Number],
        description: 'rgn++ items ids ',
        required: true,
    })
    @IsArray()
    itemIds!: number[];
    @ApiProperty({
        type: String,
        description: 'rgn++ transaction fee',
        required: true,
    })
    @IsNotEmpty()
    transactionFee!: string;
    @ApiProperty({
        type: String,
        description: 'rgn++ btc signed transaction',
        required: true,
    })
    @IsNotEmpty()
    @IsString()
    signedBTCTransaction!: string;
    @ApiProperty({
        type: CKBTransaction,
        description: 'rgn++ ckb transaction',
        required: true,
    })
    @IsNotEmptyObject()
    @ValidateNested({ each: true })
    @Type(() => CKBTransaction)
    rgbppCKBTransaction!: CKBTransaction;
}
