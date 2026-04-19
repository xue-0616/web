import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber } from 'class-validator';

export class GetAdjustmentInput {
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    chainId: any;
    @ApiProperty({
        type: (Array),
    })
    @IsArray()
    @IsNotEmpty()
    transaction: any;
}
