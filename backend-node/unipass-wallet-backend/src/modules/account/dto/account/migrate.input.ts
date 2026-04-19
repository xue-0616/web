import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetMigrateUserInfoInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    appId: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    address: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    timestamp: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    signature: any;
}

export class GetMigrateAddressInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    appId: any;
    @ApiProperty({
        type: String,
    })
    @IsEmail()
    @IsNotEmpty()
    email: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    @IsNotEmpty()
    provider: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    timestamp: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    signature: any;
}
