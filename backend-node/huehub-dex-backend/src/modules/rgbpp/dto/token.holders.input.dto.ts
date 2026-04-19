import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetHoldersInputDto {
    constructor() {
        this.paginationToken = 0;
        this.limit = 10;
    }
    @ApiProperty({
        type: Number,
        description: 'query token id',
    })
    @IsNumber()
    @Transform(({ value }) => parseInt(value, 10))
    tokenId!: number;
    @ApiPropertyOptional({
        type: String,
        description: 'token pagination',
        default: 0,
    })
    @IsString()
    paginationToken: number;
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
