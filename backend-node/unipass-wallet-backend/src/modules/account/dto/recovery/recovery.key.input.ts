import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNotEmptyObject, IsObject, IsString } from 'class-validator';
import { MasterKeyInput } from './account.master.key.input';

export class UploadRecoveryMasterKeyInput {
    @ApiProperty({
        type: MasterKeyInput,
        description: 'master key data',
    })
    @IsObject()
    @IsNotEmptyObject()
    masterKey: any;
}

export class SendRecoveryEmailInput {
    @ApiProperty({
        type: String,
        description: 'send recovery email address',
    })
    @IsString()
    @IsNotEmpty()
    verificationEmailHash: any;
    @ApiProperty({
        type: String,
        description: 'master key sig data',
    })
    @IsString()
    @IsNotEmpty()
    newMasterKeyAddress: any;
}

export class AuthStartRecoveryByOAuthInput extends SendRecoveryEmailInput {
    @ApiProperty({
        type: String,
        description: 'oauth id_token',
    })
    @IsString()
    @IsNotEmpty()
    idToken: any;
}
