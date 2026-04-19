import { ApiProperty } from '@nestjs/swagger';

export class Extensions {
    @ApiProperty()
    coingeckoId: string;
}

export class TokenInfo {
    @ApiProperty()
    name: number;
    @ApiProperty()
    symbol: string;
    @ApiProperty()
    image: string;
    @ApiProperty()
    chainId: number;
    @ApiProperty()
    extensions: Extensions;
}

export class TokenMetadata {
    @ApiProperty()
    onChainInfo: any;
    @ApiProperty()
    offChainInfo: any;
}

export class ShowTokenInfoOutputDto {
    @ApiProperty()
    mint: string;
    @ApiProperty()
    decimals: number;
    @ApiProperty()
    freezeAuthority: string;
    @ApiProperty()
    mintAuthority: string;
    @ApiProperty()
    tokenType: string;
    @ApiProperty()
    tokenList: TokenInfo;
    @ApiProperty()
    tokenMetadata: TokenMetadata;
}

export class TokenInfoOutput {
}
