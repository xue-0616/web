import { ApiProperty } from '@nestjs/swagger';

export class SnapKeyOutput {
    @ApiProperty({
        type: Boolean,
        description: 'sign raw data',
    })
    isVerify: any;
}
