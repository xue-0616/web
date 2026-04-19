import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNotEmptyObject, IsObject, IsString } from 'class-validator';
import { OtpAction } from '../../../otp/dtos';

export class StartSignInput {
    @ApiProperty({
        description: 'generate keygen step2 generate by li17_p2_key_gen2 return pubkey',
    })
    @IsString()
    @IsNotEmpty()
    localKeyAddress: any;
    @ApiProperty({
        description: 'generate sign data tss msg',
    })
    @IsObject()
    @IsNotEmptyObject()
    tssMsg: any;
    @ApiProperty({
        description: 'generate sign data tss sign value',
    })
    @IsString()
    @IsNotEmpty()
    value: any;
}

export class SignInput {
    @ApiProperty({
        description: 'sign message tss return session id',
    })
    @IsString()
    @IsNotEmpty()
    sessionId: any;
    @ApiProperty({
        description: 'sign tss msg',
    })
    @IsArray()
    tssMsg: any;
    @ApiProperty({
        enum: OtpAction,
        enumName: 'OtpAction',
        description: 'send code type',
    })
    @ApiProperty({
        description: 'generate sign data tss sign value',
    })
    @IsString()
    @IsNotEmpty()
    value: any;
}
