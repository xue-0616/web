import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetPriceConversionInput {
    @ApiProperty({
        type: String,
        description: 'cmc token id',
    })
    @IsString()
    id: any;
}
