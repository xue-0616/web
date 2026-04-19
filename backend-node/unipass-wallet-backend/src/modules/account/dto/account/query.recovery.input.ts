import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class QueryEmailStatusInput {
    @ApiProperty({
        type: String,
        description: 'query send email status',
    })
    @IsEmail()
    email: any;
}
