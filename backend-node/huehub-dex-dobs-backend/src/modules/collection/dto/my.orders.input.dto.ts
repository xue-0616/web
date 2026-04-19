import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Min, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { TypeHashValidator } from '../../../common/utils/typehash.validator';

export enum ShowOrderType {
    Listing = 0,
    SoldOut = 1,
    Bought = 2,
    Unlist = 3,
    All = 4,
}

export class MyOrdersInput {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
    @ApiProperty({
        enum: ShowOrderType,
        description: 'query order type enum,0:Listing,1:SoldOut,2:Bought,3:Unlist 4: All Order',
    })
    @IsEnum(ShowOrderType)
    @Transform(({ value }) => parseInt(value, 10))
    orderType!: ShowOrderType;
    @ApiPropertyOptional({
        type: String,
        description: 'collection type hash',
    })
    @IsOptional()
    @IsString()
    @Validate(TypeHashValidator)
    clusterTypeHash!: string;
    @ApiPropertyOptional({
        type: Number,
        description: 'page number',
        default: 0,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
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
    limit: number;
}
