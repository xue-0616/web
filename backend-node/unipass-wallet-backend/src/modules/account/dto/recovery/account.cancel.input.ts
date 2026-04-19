import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsNotEmptyObject, IsNumber, IsObject, IsString } from 'class-validator';
import { CallType } from '@unipasswallet/transactions';
// ethers v6: BigNumber removed — use native BigInt

export class Transaction {
    @ApiProperty({
        enum: CallType,
        enumName: 'CallType',
        description: 'tx Call Type',
    })
    @IsEnum(CallType, {
        message: 'action invalid， need in array [ 0,1,2,3]',
    })
    callType: any;
    @ApiProperty({
        type: Boolean,
        description: 'revertOnError',
    })
    @IsBoolean()
    revertOnError: any;
    @ApiProperty({
        type: String,
        description: 'gasLimit big Number',
    })
    @IsObject()
    @IsNotEmptyObject()
    gasLimit: any;
    @ApiProperty({
        type: String,
        description: 'tx target object',
    })
    @IsString()
    @IsNotEmpty()
    target: any;
    @ApiProperty({
        type: String,
        description: 'gasLimit big Number',
    })
    @IsObject()
    @IsNotEmptyObject()
    value: any;
    @ApiProperty({
        type: String,
        description: 'tx sign',
    })
    @IsString()
    @IsNotEmpty()
    data: any;
}

export class CancelRecoveryInput {
    @ApiProperty({
        type: Number,
        description: 'tx mata nonce',
    })
    @IsNumber()
    metaNonce: any;
    @ApiProperty({
        type: String,
        description: 'tx builder signature',
    })
    @IsString()
    @IsNotEmpty()
    signature: any;
    @ApiProperty({
        type: Transaction,
        description: 'query send recovery email address',
    })
    @IsObject()
    @IsNotEmptyObject()
    transaction: any;
}
