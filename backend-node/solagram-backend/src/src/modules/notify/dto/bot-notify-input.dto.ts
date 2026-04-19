import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BotNotifyInputDto {
    @ApiProperty({
        type: String,
    })
    @IsString()
    source: string;
    @ApiProperty({
        type: String,
    })
    @IsString()
    address: string;
    @ApiProperty({
        type: String,
    })
    @IsString()
    message: string;
}
