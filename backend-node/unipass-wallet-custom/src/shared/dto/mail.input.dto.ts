import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SuffixesInput {
    @ApiPropertyOptional({
        type: String,
        description: 'get config is from snap',
        default: 'ture',
    })
    @IsString()
    @IsOptional()
    isSnap: any;
}
