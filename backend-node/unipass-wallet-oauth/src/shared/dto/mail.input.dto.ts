// Recovered from dist/mail.input.dto.js.map (source: ../../../src/shared/dto/mail.input.dto.ts)

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SuffixesInput {
    @ApiPropertyOptional({ type: String, description: 'is snap' })
    @IsString()
    @IsOptional()
    isSnap?: string;
}
