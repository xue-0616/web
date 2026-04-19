import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class LaunchpadProjectInputDto {
    @ApiProperty({
        type: [Number],
        example: '1,2,3,4,5',
        description: 'token id list',
    })
    @Transform(({ value }) => value.split(',').map((i) => parseInt(i, 10)))
    @IsNumber({}, { each: true })
    ids: number[];
}
