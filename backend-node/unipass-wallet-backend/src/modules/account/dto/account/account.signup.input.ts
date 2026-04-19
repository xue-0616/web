import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { MasterKeyInput } from '../recovery/account.master.key.input';

export class KetSetDto {
    @ApiProperty({
        type: String,
        description: 'account register email address',
    })
    @IsEmail()
    @IsNotEmpty()
    email: any;
    @ApiProperty({
        type: String,
        description: 'register mater key address',
    })
    @IsString()
    @IsNotEmpty()
    materKeyAddress: any;
}

export class GuardianData {
    @ApiProperty({
        type: String,
        description: 'guardian email data',
    })
    @IsEmail()
    email: any;
    @ApiProperty({
        type: Boolean,
        description: 'guardian email is self email',
    })
    @IsBoolean()
    isSelfGuardian: any;
}

export class SignUpAccountInput {
    @ApiProperty({
        description: 'keyset Json',
    })
    @IsString()
    @IsNotEmpty()
    keysetJson: any;
    @ApiProperty({
        type: MasterKeyInput,
        description: 'mater key data',
    })
    @IsObject()
    @IsNotEmptyObject()
    masterKey: any;
    @ApiPropertyOptional({
        description: 'email hash add pepper hash ',
    })
    @IsString()
    @IsOptional()
    pepper: any;
    @ApiPropertyOptional({
        type: String,
        description: 'signup source',
    })
    @MaxLength(32)
    @IsOptional()
    source: any;
}
