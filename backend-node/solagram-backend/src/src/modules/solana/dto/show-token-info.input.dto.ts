import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsString } from 'class-validator';

export class ShowTokenInfoInputDto {
    @ApiProperty({
        type: [String],
        description: 'token address',
    })
    @ArrayNotEmpty()
    @IsString({ each: true })
    addresses: string[];
}
