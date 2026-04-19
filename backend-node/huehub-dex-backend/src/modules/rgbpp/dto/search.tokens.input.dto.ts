import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SearchTokensInput {
    @ApiProperty({
        type: String,
        description: 'token token key symobl or xudt type hash',
    })
    @IsString()
    searchKey!: string;
}
