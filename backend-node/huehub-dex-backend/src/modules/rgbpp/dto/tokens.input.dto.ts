import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { TypeHashtValidator } from '../../../common/utils/typehash.validator';

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

export enum TokenType {
    Hot = 0,
    Mint = 1,
    All = 2,
}

export class TokensInput {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
    @ApiPropertyOptional({
        type: String,
        description: 'mint token symbol',
    })
    @IsOptional()
    @IsString()
    symbol!: string;
    @ApiPropertyOptional({
        enum: TokenType,
        description: 'seal type 0:hot 1:minting,2:all ',
        default: TokenType.Hot,
    })
    @IsOptional()
    @IsEnum(TokenType)
    @Transform(({ value }) => parseInt(value, 10))
    tokenType!: TokenType;
    @ApiProperty({
        enum: TimeType,
        description: '0:Day 1:Week 2:Month,3:All',
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsEnum(TimeType)
    timeType!: TimeType;
    @ApiProperty({
        enum: SortDirection,
        description: '0:Desc 1:Asc',
        required: true,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsEnum(SortDirection)
    sort!: SortDirection;
    @ApiProperty({
        enum: SortField,
        description: '0:Price 1:Change 2:Volume 3:MarketCap 4:Sales  5 holders,6:ProgressRate, 7:Deployed,',
        required: true,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsEnum(SortField)
    sortBy!: SortField;
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

export class TokensInfoInput {
    @ApiPropertyOptional({
        enum: Number,
        description: 'token id',
        required: true,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @IsOptional()
    @Min(1)
    id?: number;
    @ApiPropertyOptional({
        enum: String,
        description: 'token xudt type hash',
    })
    @IsOptional()
    @IsString()
    @Validate(TypeHashtValidator)
    xudtTypeHash?: string;
}
