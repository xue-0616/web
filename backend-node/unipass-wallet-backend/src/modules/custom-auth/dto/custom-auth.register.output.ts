import { ApiProperty } from '@nestjs/swagger';

export class CustomAuthRegisterOutput {
    @ApiProperty({ type: String })
    authorization: any;
    @ApiProperty({ type: String })
    address: any;
    @ApiProperty({ type: String })
    keysetHash: any;
}
