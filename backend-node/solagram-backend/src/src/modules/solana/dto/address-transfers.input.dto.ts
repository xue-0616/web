import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddressTransfersInputDto {
    @ApiProperty({ type: String })
    @IsString()
    address: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    mint: string;
    @ApiProperty({ type: Number })
    @Transform(({ value }) => parseInt(value, 10))
    @Min(1)
    @IsNumber()
    page: number;
}
