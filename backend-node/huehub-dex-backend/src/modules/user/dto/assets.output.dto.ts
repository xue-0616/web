import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ShowUtxoStatus {
    ListUtxo = 0,
    ListPendingUtox = 1,
    LiveUtxo = 2,
    FreezeUtxo = 3,
}

export class UTXOInfo {
    @ApiProperty({
        type: String,
        description: 'utxo tx hash',
    })
    txHash!: string;
    @ApiProperty({
        type: Number,
        description: 'utxo index',
    })
    index!: number;
    @ApiProperty({
        type: String,
        description: 'btc value',
    })
    value!: string;
    @ApiProperty({
        enum: ShowUtxoStatus,
        description: '0:ListUtxo 1:ListPendingUtox,2:LiveBtcUtxo,3:FreezeBtcUtxo',
    })
    status!: ShowUtxoStatus;
    @ApiPropertyOptional({
        type: String,
        description: 'rgb++ token amount',
    })
    tokenAmount!: string;
    @ApiPropertyOptional({
        type: Number,
        description: 'utxo bind item id',
    })
    itemId!: number;
}

export class TokenInfo {
    @ApiProperty({
        type: Number,
        description: 'token id',
    })
    id!: number;
    @ApiProperty({
        type: String,
        description: 'token url',
    })
    iconUrl!: string;
    @ApiProperty({
        type: String,
        description: 'token name',
    })
    name!: string;
    @ApiProperty({
        type: String,
        description: 'token symbol',
    })
    symbol!: string;
    @ApiProperty({
        type: String,
        description: 'The btc price of selling a single rgb++ token in Satoshi / token',
    })
    pricePerToken!: string;
    @ApiProperty({
        type: String,
        description: 'The btc price of selling a single rgb++ token in USD',
    })
    usdPricePerToken!: string;
    @ApiProperty({
        type: String,
        description: 'rgb++ token amount',
    })
    amount!: string;
    @ApiProperty({
        type: Number,
        description: 'sell rgb++ token decimal',
    })
    tokenDecimal!: number;
    @ApiProperty({
        type: Number,
        description: 'rgb++ token utxo count',
    })
    utxoCount!: number;
    @ApiProperty({
        type: String,
        description: 'rgbpp type code hash',
    })
    xudtCodeHash!: string;
    @ApiProperty({
        type: String,
        description: 'rgbpp type args',
    })
    xudtArgs!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'xudt token type hash',
    })
    xudtTypeHash!: string;
}

export class AssetInfo {
    @ApiProperty({
        type: [TokenInfo],
        description: 'token info',
    })
    tokenInfo!: TokenInfo;
    @ApiProperty({
        type: [UTXOInfo],
        description: 'When fullUTXO is true, return detailed information. If false, return empty',
    })
    utxos!: UTXOInfo[];
}

export class AssetsOutputDto {
    @ApiProperty({
        type: [AssetInfo],
        description: 'token list',
    })
    tokens!: AssetInfo[];
    @ApiProperty({
        type: String,
        description: 'btc balance',
    })
    balance!: string;
    @ApiProperty({
        type: String,
        description: 'available btc balance',
    })
    availableBalance!: string;
    @ApiProperty({
        type: String,
        description: 'frozen btc balance',
    })
    frozenBalance!: string;
}
