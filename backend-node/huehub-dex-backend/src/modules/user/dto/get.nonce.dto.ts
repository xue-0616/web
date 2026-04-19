import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class GetNonceInput {
    @ApiProperty({
        type: String,
        description: 'get nonce for btc address verification',
        required: true,
    })
    @IsNotEmpty()
    address!: string;
}

export class GetNonceOutput {
    @ApiProperty({
        type: String,
        description: 'The nonce string that requires a signature',
        required: true,
    })
    nonce!: string;
    @ApiProperty({
        type: String,
        description: 'Message string that requires signature',
        required: true,
    })
    message!: string;
}
