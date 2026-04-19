import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetApTransactionSignatureInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    ap: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    chainId: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    nonce: any;
    @ApiProperty({
        type: (Array),
    })
    @IsArray()
    @IsNotEmpty()
    txs: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    timestamp: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    targetAddress: any;
}

export class LockActionPointInput extends GetApTransactionSignatureInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    apSig: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    relayerSig: any;
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
    relayerTxHash: any;
}

export class DeductActionPointInput {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    relayerSig: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    relayerTxHash: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    chainTxHash: any;
}
