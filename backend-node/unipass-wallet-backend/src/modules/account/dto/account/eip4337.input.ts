import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber } from 'class-validator';

export enum SignType {
    AddHookEIP4337 = "AddHookEIP4337",
}

export class EIP4337Input {
    @ApiProperty({
        enum: SignType,
        enumName: 'SignType',
    })
    @IsEnum(SignType)
    signType: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    nonce: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    chainId: any;
    @ApiProperty({
        type: (Array),
    })
    @IsArray()
    @IsNotEmpty()
    txs: any;
}

export class EIP4337Output {
    @ApiProperty({
        type: String,
    })
    policySig: any;
}
