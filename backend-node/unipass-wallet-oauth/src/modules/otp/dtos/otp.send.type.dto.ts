// Recovered from dist/otp.send.type.dto.js.map (source: ../../../../src/modules/otp/dtos/otp.send.type.dto.ts)

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class BindAuthPhone {
    @ApiProperty({ type: String, description: 'get bind phone number' })
    @IsString()
    @IsNotEmpty()
    phone!: string;

    @ApiProperty({ type: String, description: 'get bind phone area code' })
    @IsString()
    @IsNotEmpty()
    areaCode!: string;
}
