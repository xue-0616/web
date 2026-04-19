import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { AuthType } from '../../entities';

export class AddAuthenticatorInput {
    @ApiProperty({
        enum: AuthType,
        enumName: 'AuthType',
        description: '2fa type',
    })
    @IsEnum(AuthType, {
        message: 'action invalid， need in array [0,1,2,3]',
    })
    type: any;
    @ApiProperty({
        type: String,
        description: '2fa verify data email:xxx@xx.xx,phone:"{phone:"",areaCode:""}",ga:xxxx',
        default: {},
    })
    @IsString()
    @IsNotEmpty()
    value: any;
    @ApiProperty({
        type: String,
        description: '2fa verify code',
        default: '123456',
    })
    @IsString()
    @IsNotEmpty()
    code: any;
    @ApiPropertyOptional({
        type: String,
        description: '2fa oauth',
        default: '',
    })
    @IsString()
    @IsOptional()
    idToken: any;
    @ApiPropertyOptional({
        type: String,
        description: '2fa device info',
        default: '',
    })
    @IsString()
    @IsOptional()
    deviceInfo: any;
}

export class DeleteAuthenticatorInput {
    @ApiProperty({
        enum: AuthType,
        enumName: 'AuthType',
        description: '2fa type',
    })
    @IsEnum(AuthType, {
        message: 'action invalid， need in array [0,1,2,3]',
    })
    type: any;
    @ApiProperty({
        type: String,
        description: '2fa oauth',
        default: '',
    })
    @IsString()
    @IsNotEmpty()
    idToken: any;
    @ApiPropertyOptional({
        type: (Array),
        description: '2fa webauthn id array',
    })
    @IsArray()
    @IsOptional()
    credentialIDs: any;
}

export class AuthenticatorListInput {
    @ApiProperty({
        type: Boolean,
        description: 'true:show 2fa all status data. false:show 2fa open status data',
    })
    @IsBoolean()
    showAllStatus: any;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    @IsOptional()
    type: any;
}
