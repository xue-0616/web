import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetIssueAddressInputDto {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
    @ApiProperty({
        type: String,
        example: '1,2,3,4,5',
        description: 'token id list',
    })
    @IsOptional()
    @Transform(({ value }) => value.split(',').map((i) => parseInt(i, 10)))
    @IsNumber({}, { each: true })
    ids: number[];
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
    @ApiProperty({
        type: String,
        description: 'issue script sig message',
    })
    sigMessage: string;
    @ApiProperty({
        type: String,
        description: 'issue script sig',
    })
    sig: string;
}
