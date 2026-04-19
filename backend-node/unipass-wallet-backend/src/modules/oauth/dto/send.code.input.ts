import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum SendType {
    email = "email",
    phone = "phone",
}

export class SendCodeInput {
    @ApiProperty({
        enum: SendType,
        enumName: 'SendType',
        description: 'send code type',
    })
    @IsEnum(SendType)
    sendType: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsEmail()
    @IsOptional()
    email: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    phone: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    areaCode: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsEmail()
    @IsOptional()
    source: any;
}

export class VerifyCodeInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    code: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsEmail()
    @IsOptional()
    email: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsEmail()
    @IsOptional()
    source: any;
}
