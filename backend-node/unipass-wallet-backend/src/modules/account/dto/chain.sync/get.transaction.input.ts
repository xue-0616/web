import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetTransactionInput {
    @ApiProperty({
        type: String,
        description: 'need query sync chain node name',
    })
    @IsString()
    @IsNotEmpty()
    authChainNode: any;
}
