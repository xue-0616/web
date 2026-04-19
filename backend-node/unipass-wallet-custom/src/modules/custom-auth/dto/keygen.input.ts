import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNotEmptyObject, IsObject, IsString } from 'class-validator';

export class KeyGenInput {
    @ApiProperty({
        type: String,
        description: 'generate keygen step2 account sessionId',
    })
    @IsString()
    @IsNotEmpty()
    sessionId: any;
    @ApiProperty({
        description: 'generate keygen step1 generate by li17_p2_key_gen1 Object',
    })
    @IsObject()
    @IsNotEmptyObject()
    tssMsg: any;
}
