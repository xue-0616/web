import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum SignType {
    PersonalSign = 0,
    EIP712Sign = 1,
    Transaction = 2,
}

export class AuditSignContentInput {
    @ApiProperty({
        enum: SignType,
        enumName: 'SignType',
        description: 'audit sign type',
    })
    @IsEnum(SignType, {
        message: 'type invalid， need in array [0，1，2]',
    })
    type: any;
    @ApiPropertyOptional({ description: 'Transaction | string |EIP712Message' })
    @IsOptional()
    content: any;
    @ApiProperty({ description: 'tss start sign => value' })
    @IsString()
    @IsNotEmpty()
    msg: any;
}

export class UpSignTokenInput {
    @ApiProperty({ description: 'oAuth idToken' })
    @IsString()
    @IsNotEmpty()
    idToken: any;
    @ApiProperty({
        description: '0: Only valid for this time, others: the time from the current expiration（minute）60，120，240',
    })
    @IsNumber()
    duration: any;
}
