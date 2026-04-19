import { ApiProperty } from '@nestjs/swagger';

export class GetOnRampUrlOutput {
    @ApiProperty({
        type: String,
    })
    url: any;
}
