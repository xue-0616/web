import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Min, Validate } from 'class-validator';
import { TypeHashValidator } from '../../../common/utils/typehash.validator';
import { Transform } from 'class-transformer';
import { SortDirection } from './collections.input.dto';

export class ItemsInputDto {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
    @ApiProperty({
        type: String,
        description: 'collection type hash',
    })
    @IsString()
    @Validate(TypeHashValidator)
    clusterTypeHash!: string;
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
