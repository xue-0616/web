import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class OrderPendingInputDto {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
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
