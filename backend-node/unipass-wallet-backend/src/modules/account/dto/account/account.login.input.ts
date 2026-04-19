import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EmailProviderCheckInput {
    @ApiProperty({
        type: String,
        description: 'user email address',
    })
    @IsString()
    @IsNotEmpty()
    email: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    source: any;
}

export class EmailProviderCheckOutput {
    @ApiPropertyOptional({
        type: Number,
        description: 'sign timestamp unit second',
    })
    provider: any;
}
