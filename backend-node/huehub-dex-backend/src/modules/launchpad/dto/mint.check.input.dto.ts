import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class MintCheckInputDto {
    @ApiProperty({
        type: Number,
        example: 1,
        description: 'token id',
    })
    @IsNumber()
    @Transform(({ value }) => parseInt(value))
    id: number;
    @ApiProperty({
        type: Number,
        example: 1,
        description: 'round id',
    })
    @IsNumber()
    @Transform(({ value }) => parseInt(value))
    roundId: number;
}
