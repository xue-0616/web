import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class SuffixesOutput {
    @ApiProperty({
        type: [String],
        description: 'List of allowed mailbox suffixes',
    })
    @IsArray()
    suffixes: any;
    @ApiProperty({
        type: String,
        description: 'keyset policy  address',
    })
    @IsString()
    @IsNotEmpty()
    policyAddress: any;
    @ApiProperty({
        type: String,
        description: 'keyset policy key json',
    })
    @IsString()
    @IsNotEmpty()
    policyKeysetJson: any;
}
