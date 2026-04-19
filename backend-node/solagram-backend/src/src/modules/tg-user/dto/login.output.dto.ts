import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CognitoResult {
    region!: string;
    identityPoolId!: string;
    userPoolId!: string;
    kmsKeyId!: string;
    idToken!: string;
}
export class LoginOutputDto {
    @ApiProperty({
        type: String,
    })
    @IsString()
    jwt!: string;
    keyEncrypted?: string;
    cognitoResult?: CognitoResult;
}
