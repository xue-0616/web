import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Validate } from 'class-validator';
import { TypeHashtValidator } from '../../../common/utils/typehash.validator';

export enum StaticsTimeType {
    Day = 0,
    Week = 1,
    Month = 2,
}

export class TokensStatisticInput {
    @ApiProperty({
        enum: StaticsTimeType,
        description: '0:Day 1:Week 2:Month',
        required: true,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsEnum(StaticsTimeType)
    timeType!: StaticsTimeType;
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
        description: 'query token id',
    })
    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => parseInt(value, 10))
    tokenId!: number;
}
