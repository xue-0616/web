import { ApiProperty } from '@nestjs/swagger';

export class BlinkShortCodeOutputDto {
    @ApiProperty({
        type: String,
        description: 'blink url',
    })
    url!: string | null;
}
