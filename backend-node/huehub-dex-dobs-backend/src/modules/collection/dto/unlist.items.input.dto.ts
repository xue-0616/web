import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNotEmptyObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CKBTransaction } from './buy.tems.input.dto';

export class UnlistItemsInputDto {
    @ApiProperty({
        type: [Number],
        description: 'dobs items ids ',
        required: true,
    })
    @IsArray()
    itemIds!: number[];
    @ApiProperty({
        type: String,
        description: 'dobs transaction fee',
        required: true,
    })
    @IsNotEmpty()
    transactionFee!: string;
    @ApiProperty({
        type: String,
        description: 'dobs btc signed transaction',
        required: true,
    })
    @IsNotEmpty()
    @IsString()
    signedBTCTransaction!: string;
    @ApiProperty({
        type: CKBTransaction,
        description: 'dobs ckb transaction',
        required: true,
    })
    @IsNotEmptyObject()
    @ValidateNested({ each: true })
    @Type(() => CKBTransaction)
    rgbppCKBTransaction!: CKBTransaction;
}
