import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GarbActionParamInputDto {
    @ApiProperty({
        type: Number,
    })
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    id!: number;
}
