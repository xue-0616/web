import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { KeyType } from '../../../interfaces';

export class KeySig {
    @ApiProperty({
        type: String,
        description: 'key sig string',
    })
    @IsString()
    @IsNotEmpty()
    sig: any;
    @ApiProperty({
        type: String,
        description: 'sign raw data',
    })
    @IsNumber()
    message: any;
}

export class MasterKeyInput {
    @ApiProperty({
        type: String,
        description: 'master key address',
    })
    @IsString()
    @IsNotEmpty()
    masterKeyAddress: any;
    @ApiProperty({
        type: String,
        description: 'master key key store',
    })
    @IsString()
    @IsOptional()
    keyStore: any;
    @ApiProperty({
        enum: KeyType,
        enumName: 'KeyType',
        description: 'master key type 0: MPC, 1:snaps ，2 Metamask',
    })
    @IsEnum(KeyType, {
        message: 'master key type 0: MPC, 1:snaps ，2 Metamask,3 AWS_KMS_KEY',
    })
    @IsOptional()
    keyType: any;
    @ApiProperty({
        type: KeySig,
        description: 'key sig data',
    })
    @IsOptional()
    keySig: any;
}

export class MasterKeySigInput {
    @ApiProperty({
        type: String,
        description: 'master key address',
    })
    @IsString()
    @IsNotEmpty()
    masterKeyAddress: any;
    @ApiProperty({
        type: String,
        description: 'update keyset master key sig',
    })
    @IsString()
    @IsNotEmpty()
    sig: any;
    @ApiProperty({
        type: String,
        description: 'update keyset master key sig digestHash',
    })
    @IsString()
    @IsNotEmpty()
    digestHash: any;
    @ApiProperty({
        type: Number,
        description: 'tx send metaNonce',
    })
    @IsNumber()
    metaNonce: any;
}
