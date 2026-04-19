// Recovered from dist/mail.out.dto.js.map (source: ../../../src/shared/dto/mail.out.dto.ts)

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class SuffixesOutput {
    @ApiProperty({ type: [String], description: 'email suffixes' })
    @IsArray()
    suffixes!: string[];

    @ApiProperty({ type: String, description: 'keyset policy  address' })
    @IsString()
    @IsNotEmpty()
    policyAddress!: string;

    @ApiProperty({ type: String, description: 'keyset policy key json' })
    @IsString()
    @IsNotEmpty()
    policyKeysetJson!: string;
}
