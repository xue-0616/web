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
    @ApiProperty({
        type: Number,
        description: 'utxo bind spore type hash',
    })
    sporeTypeHash!: string;
    @ApiProperty({
        type: Number,
        description: 'utxo bind spore args',
    })
    sporeArgs!: string;
    @ApiPropertyOptional({
        type: Number,
        description: 'utxo bind item id',
    })
    itemId!: number;
    @ApiPropertyOptional({
        type: String,
        description: 'dobs collections name',
    })
    name!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'spore prevBg base64  data',
    })
    prevBg!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'spore prev.bgcolor',
    })
    prevBgColor!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'spore prev.type',
    })
    prevType!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'spore dobId',
    })
    dobId!: string;
}

export class CollectionInfo {
    @ApiProperty({
        type: Number,
        description: 'collection id',
    })
    id!: number;
    @ApiProperty({
        type: String,
        description: 'collection url',
    })
    iconUrl!: string;
    @ApiProperty({
        type: String,
        description: 'collection name',
    })
    name!: string;
    @ApiProperty({
        type: String,
        description: 'collection description',
    })
    description!: string;
    @ApiProperty({
        type: String,
        description: 'The btc price, unit Satoshi / nft',
    })
    price!: string;
    @ApiProperty({
        type: String,
        description: 'The btc price in USD',
    })
    usdPrice!: string;
    @ApiProperty({
        type: Number,
        description: 'dobs nft amount',
    })
    amount!: number;
    @ApiProperty({
        type: Number,
        description: 'dobs nft decimal',
    })
    decimal!: number;
    @ApiProperty({
        type: Number,
        description: 'dobs collect utxo count',
    })
    utxoCount!: number;
    @ApiProperty({
        type: String,
        description: 'cluster type args',
    })
    clusterArgs!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'cluster type hash',
    })
    clusterTypeHash!: string;
}

export class AssetInfo {
    @ApiProperty({
        type: CollectionInfo,
        description: ' Dobs collection info',
    })
    collectionInfo!: CollectionInfo;
    @ApiProperty({
        type: [UTXOInfo],
        description: 'When fullUTXO is true, return detailed information. If false, return empty',
    })
    utxos!: UTXOInfo[];
}

export class AssetsOutputDto {
    @ApiProperty({
        type: [AssetInfo],
        description: 'nft asset list',
    })
    collections!: AssetInfo[];
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
