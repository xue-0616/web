import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Min, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { TypeHashValidator } from '../../../common/utils/typehash.validator';

export enum TimeType {
    Day = 0,
    Week = 1,
    Month = 2,
    All = 3,
}

export enum SortDirection {
    Desc = 0,
    Asc = 1,
}

export enum SortField {
    Price = 0,
    Change = 1,
    Volume = 2,
    MarketCap = 3,
    Sales = 4,
    holders = 5,
    ProgressRate = 6,
    IssuedAt = 7,
}

export enum CollectionType {
    Hot = 0,
    All = 1,
}

export class CollectionsInput {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
    @ApiProperty({
        enum: CollectionType,
        description: 'seal type 0:hot 1:all ',
        default: CollectionType.Hot,
    })
    @IsEnum(CollectionType)
    @Transform(({ value }) => parseInt(value, 10))
    collectionType!: CollectionType;
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

export class CollectionsInfoInput {
    @ApiProperty({
        enum: String,
        description: 'collection type hash',
    })
    @IsString()
    @Validate(TypeHashValidator)
    clusterTypeHash!: string;
}
