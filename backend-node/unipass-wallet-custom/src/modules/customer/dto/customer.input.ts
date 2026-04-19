import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CustomerInput {
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    gasTankBalance: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    sub: any;
    @ApiProperty({
        type: String,
    })
    @IsNumber()
    @IsNotEmpty()
    provider: any;
    @ApiProperty({
        type: String,
    })
    @IsNumber()
    @IsNotEmpty()
    status: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    timestamp: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    adminSig: any;
}
