import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UserLoginInput {
    @ApiProperty({
        type: String,
        description: 'get nonce for btc address verification',
        required: true,
    })
    @IsNotEmpty()
    address!: string;
    @ApiProperty({
        type: String,
        description: 'btc public key',
        required: true,
    })
    @IsNotEmpty()
    publicKey!: string;
    @ApiProperty({
        type: String,
        description: 'btc address signature',
        required: true,
    })
    @IsNotEmpty()
    signature!: string;
    @ApiProperty({
        type: String,
        description: 'btc address nonce',
        required: true,
    })
    @IsNotEmpty()
    nonce!: string;
}

export class UserLoginOutput {
    @ApiProperty({
        type: Boolean,
        description: 'The btc signature verification status',
        required: true,
    })
    isVerified!: boolean;
    @ApiProperty({
        type: String,
        description: 'Access Token after signature verification passed',
        required: false,
    })
    accessToken!: string;
}
