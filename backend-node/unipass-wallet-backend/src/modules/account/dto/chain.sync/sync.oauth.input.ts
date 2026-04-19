import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SyncByOAuthIdToken {
    @ApiProperty({
        type: String,
        description: 'oauth id token',
    })
    @IsString()
    @IsNotEmpty()
    idToken: any;
    @ApiProperty({
        description: '0: Only valid for this time, others: the time from the current expiration（minute）60，120，240',
    })
    @IsNumber()
    duration: any;
}
