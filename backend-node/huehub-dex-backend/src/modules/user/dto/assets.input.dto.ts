import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Validate } from 'class-validator';
import { TypeHashtValidator } from '../../../common/utils/typehash.validator';

export class AssetsInputDto {
    @ApiPropertyOptional({
        type: Number,
        description: 'token id',
    })
    @IsNumber()
    @IsOptional()
    tokenId!: number;
    @ApiPropertyOptional({
        type: String,
        description: 'xudt token type hash',
    })
    @IsOptional()
    @IsString()
    @Validate(TypeHashtValidator)
    xudtTypeHash!: string;
    @ApiPropertyOptional({
        type: Boolean,
        description: 'Indicates whether to return detailed utxo information',
    })
    @IsBoolean()
    @IsOptional()
    fullUTXO!: boolean;
}
