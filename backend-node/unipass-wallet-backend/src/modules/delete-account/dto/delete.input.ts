import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteAccountInput {
    @ApiProperty({ type: String })
    @IsString()
    address: any;
    @ApiProperty({ type: String })
    @IsString()
    source: any;
}
