import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class ShowRoundsInput {
    @ApiProperty({
        type: Number,
        description: 'token id',
        example: 1,
    })
    @IsNumber()
    @Transform(({ value }) => parseInt(value))
    id: number;
}
