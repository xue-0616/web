import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BindAuthPhone {
    @ApiProperty({
        type: String,
        description: 'get bind phone number ',
    })
    @IsString()
    @IsNotEmpty()
    phone: any;
    @ApiProperty({
        type: String,
        description: 'get bind phone area code',
    })
    @IsString()
    @IsNotEmpty()
    areaCode: any;
}
