import { ApiProperty } from '@nestjs/swagger';

export class SignUpAccountOutput {
    @ApiProperty({
        type: String,
        description: 'account evm address',
    })
    address: any;
    @ApiProperty({
        type: String,
        description: 'account evm keyset hash',
    })
    keysetHash: any;
    @ApiProperty({
        type: String,
        description: 'unipas jwt authorization token',
    })
    authorization: any;
    @ApiProperty({
        type: String,
        description: 'unipas sign token',
    })
    upSignToken: any;
}
