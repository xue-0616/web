import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class CustomAuthConfigInput {
    @ApiProperty({
        type: String,
        default: 'sparkle',
    })
    @IsString()
    appId: any;
    @ApiProperty({
        type: Number,
        default: 1,
    })
    @IsNumber()
    chainId: any;
}
