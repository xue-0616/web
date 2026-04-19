import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export enum QrCodeId {
    code0 = 0,
    code1 = 1,
    code2 = 2,
    code3 = 3,
    code4 = 4,
    code5 = 5,
    code6 = 6,
    code7 = 7,
}

export class GetMintInput {
    @ApiProperty({
        enum: QrCodeId,
        enumName: 'QrCodeId',
    })
    @IsEnum(QrCodeId, {
        message: 'qrCodeId invalid',
    })
    qrCodeId: any;
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    address: any;
}

export class GetShortKeyInput {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    address: any;
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    tokenId: any;
    @ApiProperty({ type: Number })
    @IsNumber()
    deadline: any;
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    signature: any;
    @ApiProperty({ type: String })
    @IsString()
    contractAddress: any;
}

export class GetShortKeyClaimInput {
    @ApiProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    shortKey: any;
}
