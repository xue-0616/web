import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TxRawDataInputDto {
    @ApiProperty({
        type: String,
    })
    @IsString()
    method!: string;
    @ApiProperty({ type: String })
    @IsString()
    nonce!: string;
    @ApiProperty({ type: String })
    @IsString()
    data!: string;
}
