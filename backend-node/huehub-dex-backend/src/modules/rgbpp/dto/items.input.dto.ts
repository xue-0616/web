import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { TypeHashtValidator } from '../../../common/utils/typehash.validator';
import { SortDirection } from './tokens.input.dto';

export class ItemsInputDto {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
    @ApiPropertyOptional({
        type: Number,
        description: 'token id',
        required: true,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    tokenId!: number;
    @ApiPropertyOptional({
        type: String,
        description: 'xudt token type hash',
    })
    @IsOptional()
    @IsString()
    @Validate(TypeHashtValidator)
    xudtTypeHash!: string;
    @ApiProperty({
        enum: SortDirection,
        description: '0:Desc 1:Asc',
        required: true,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsEnum(SortDirection)
    sort!: SortDirection;
    @ApiPropertyOptional({
        type: Number,
        description: 'page number',
        default: 0,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @Min(0)
    @IsOptional()
    page: number;
    @ApiPropertyOptional({
        type: Number,
        required: true,
        default: 10,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @Min(10)
    limit: number;
}
