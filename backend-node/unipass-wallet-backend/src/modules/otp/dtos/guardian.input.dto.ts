import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyGuardianInput {
    @ApiProperty({
        type: String,
        description: 'account registe email address',
    })
    @IsString()
    @IsNotEmpty()
    data: any;
}
