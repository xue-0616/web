import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotifierRegisterDto {
    @ApiProperty({ description: 'Firebase Cloud Messaging registration token' })
    @IsString()
    @IsNotEmpty()
    @MinLength(100, { message: 'Firebase token must be at least 100 characters' })
    @MaxLength(300, { message: 'Firebase token must be at most 300 characters' })
    token!: string;
}
