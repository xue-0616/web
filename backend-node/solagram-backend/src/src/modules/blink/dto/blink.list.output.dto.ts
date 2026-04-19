import { ApiProperty } from '@nestjs/swagger';

export class BlinkListOutput {
    @ApiProperty({
        type: [String],
        description: 'blink action list',
    })
    list!: string[];
}
