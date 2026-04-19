import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FinishKeygenInput {
    @ApiProperty({
        type: String,
        description: 'generate keygen step2 account userId',
    })
    @IsString()
    @IsNotEmpty()
    userId: any;
    @ApiProperty({
        type: String,
        description: 'generate keygen step2 account sessionId',
    })
    @IsString()
    @IsNotEmpty()
    sessionId: any;
    @ApiProperty({
        description: 'generate keygen step2 generate by li17_p2_key_gen2 return pubkey',
    })
    @IsString()
    @IsNotEmpty()
    localKeyAddress: any;
}
