import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { TypeHashtValidator } from '../../../common/utils/typehash.validator';

export class HoldersInputDto {
    constructor() {
        this.page = 1;
        this.limit = 10;
    }
    @ApiPropertyOptional({
        type: Number,
        description: 'query token id',
    })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseInt(value, 10))
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
        type: Number,
        description: 'page number',
        default: 0,
    })
    @IsOptional()
    @Transform(({ value }) => 1 + parseInt(value, 10))
    @Min(0)
    page: number;
    @ApiPropertyOptional({
        type: Number,
        required: true,
        default: 10,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @Min(10)
    @Max(50)
    limit: number;
}
