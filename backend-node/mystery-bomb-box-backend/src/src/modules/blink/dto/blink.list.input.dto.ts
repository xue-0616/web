import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export enum BlinkType {
    InProgress = 0,
    Completed = 1,
}

export class BlinkListInputDto {
    @ApiProperty({
        type: Number,
        description: 'Page number, must be an integer greater than or equal to 1',
    })
    @Transform(({ value }) => parseInt(value, 10))
    @Min(0)
    @IsNumber()
    page!: number;
    @ApiProperty({
        type: Number,
        description: 'Number of items per page, must be an integer between 1 and 100',
    })
    @Transform(({ value }) => parseInt(value, 10))
    @Max(100)
    @IsNumber()
    limit!: number;
    @ApiProperty({
        enum: BlinkType,
        description: 'The type of Blink: 0 for InProgress, 1 for Completed',
    })
    @IsEnum(BlinkType)
    @Transform(({ value }) => parseInt(value, 10))
    type!: BlinkType;
}
