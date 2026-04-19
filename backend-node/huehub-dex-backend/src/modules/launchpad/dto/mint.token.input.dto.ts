import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class MintInputDto {
    @ApiProperty({
        type: Number,
        example: 1,
        description: 'token id',
    })
    @IsNumber()
    id: number;
    @ApiProperty({
        type: Number,
        example: 1,
        description: 'round id',
    })
    @IsNumber()
    roundId: number;
    @ApiProperty({
        type: String,
        example: 'abc...',
        description: 'signed psbt',
    })
    @IsString()
    mintBtcTx: string;
}
