import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { TypedData } from '@unipasswallet/popup-utils';

export enum Prefix {
    UniPassPrefix = "\u0018UniPass Signed Message:\n",
    EIP191Prefix = "\u0019Ethereum Signed Message:\n",
}

export class IsValidMessageSignatureInput {
    @ApiProperty({
        type: String,
        description: 'the wallet address',
    })
    @IsString()
    @IsNotEmpty()
    walletAddress!: string;
    @ApiProperty({
        type: String,
        description: 'the chain id of the signature, ie. "1","137", etc',
    })
    @IsString()
    @IsNotEmpty()
    chainId!: string;
    @ApiProperty({
        type: String,
        description: 'the message in utf8 text encoding',
    })
    @IsString()
    @IsNotEmpty()
    message!: string;
    @ApiProperty({
        type: String,
        description: 'the signature in hex encoding',
    })
    @IsString()
    @IsNotEmpty()
    signature!: string;
    @ApiProperty({
        type: String,
        description: 'the message prefix',
    })
    @IsString()
    @IsNotEmpty()
    prefix!: string;
}

export class IsIsValidTypedDataSignatureInput {
    @ApiProperty({
        type: String,
        description: 'the wallet address',
    })
    @IsString()
    @IsNotEmpty()
    walletAddress!: string;
    @ApiProperty({
        type: String,
        description: 'the chain id of the signature, ie. "1" or "mainnet", or "137" or "polygon", etc',
    })
    @IsString()
    @IsNotEmpty()
    chainId!: string;
    @ApiProperty({
        type: String,
        description: 'the signature in hex encoding',
    })
    @IsString()
    @IsNotEmpty()
    signature!: string;
    @ApiProperty({
        type: Object,
    })
    @IsObject()
    typeData!: any;
}
