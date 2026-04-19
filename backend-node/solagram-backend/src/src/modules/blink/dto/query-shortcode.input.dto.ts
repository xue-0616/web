import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class BlinkInfo {
    @ApiProperty({
        type: String,
        description: 'blink list',
    })
    @IsArray()
    blink: string;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsOptional()
    id: number;
}

export class QueryShortCodeInput {
    @ApiProperty({
        type: [BlinkInfo],
        description: 'blink list',
    })
    @IsArray()
    blinks: BlinkInfo[];
    @ApiProperty({
        type: String,
    })
    @IsString()
    domain: string;
}
