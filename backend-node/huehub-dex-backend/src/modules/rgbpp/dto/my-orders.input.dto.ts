import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum OrderType {
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
        enum: OrderType,
        description: 'query order type enum,0:Listing,1:SoldOut,2:Bought,3:Unlist 4: All Order',
    })
    @IsEnum(OrderType)
    @Transform(({ value }) => parseInt(value, 10))
    orderType!: OrderType;
    @ApiPropertyOptional({
        type: Number,
        description: 'token id',
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsOptional()
    @IsNumber()
    tokenId!: number;
    @ApiPropertyOptional({
        type: String,
        description: 'xudt token type hash',
    })
    @IsOptional()
    @IsString()
    xudtTypeHash!: string;
    @ApiProperty({
        type: String,
        description: 'query address',
    })
    @IsNotEmpty()
    address!: string;
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
