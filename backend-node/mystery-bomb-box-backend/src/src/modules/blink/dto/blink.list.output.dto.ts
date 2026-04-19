import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlinkInfo {
    @ApiProperty({
        type: Number,
        description: 'blink id',
    })
    id!: number;
    @ApiProperty({
        type: Number,
        description: 'The total amount of the mystery bomb box',
    })
    mysteryBoxAmount!: number;
    @ApiProperty({
        type: Number,
        description: 'The number of bombs in the mystery bomb box',
    })
    bombNumber!: number;
    @ApiProperty({
        type: Number,
        description: 'The total number of mystery boxes in the Blink',
    })
    totalBoxCount!: number;
    @ApiProperty({
        type: Number,
        description: 'The number of participants who have grabbed the mystery bomb box',
    })
    participantCount!: number;
    @ApiProperty({
        type: Number,
        description: 'The start time of the red envelope event',
    })
    startTime!: number;
    @ApiProperty({
        type: String,
        description: 'The address of the mystery bomb box creator',
    })
    initiatorAddress!: string;
    @ApiProperty({
        type: String,
        description: 'The URL of the Blink',
    })
    blinkUrl!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'The URL of the Blink',
    })
    directLink!: string | null;
    @ApiPropertyOptional({
        type: Number,
        description: 'The amount won or lost in the mystery bomb box (positive for win, negative for loss). This field is only returned when the Blink has ended.',
    })
    winLossAmount!: number;
}

export class BlinkOutputDto {
    @ApiProperty({
        type: [BlinkInfo],
        description: 'An array of Blink information objects, representing the list of Blinks (mystery bomb boxes)',
    })
    list!: BlinkInfo[];
}
