import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QueryShortCodeOutput {
    @ApiProperty({
        type: String,
    })
    blink: string;
    @ApiProperty({
        type: String,
    })
    shortCode: string;
    @ApiPropertyOptional({
        type: Number,
    })
    id: number;
}
