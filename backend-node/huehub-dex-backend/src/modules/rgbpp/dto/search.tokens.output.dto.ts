import { ApiProperty } from '@nestjs/swagger';
import { TokenInfoDto } from './tokens.output.dto';

export class SearchTokensOutput {
    @ApiProperty({
        type: [TokenInfoDto],
        description: 'search token list',
    })
    list!: TokenInfoDto[];
}
