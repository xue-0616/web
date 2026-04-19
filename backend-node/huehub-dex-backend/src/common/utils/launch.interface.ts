/// <reference types="@nervosnetwork/ckb-types/index.d.ts" />
import { Address, Hex, IndexerCell, RgbppTokenInfo } from '@rgbpp-sdk/ckb';
import { Collector } from './launch.collector';
export interface RgbppLaunchVirtualTxResult {
    ckbRawTx: CKBComponents.RawTransaction;
    commitment: Hex;
}
export interface RgbppLaunchCkbVirtualTxParams {
    collector: Collector;
    ownerRgbppLockArgs: Address;
    launchAmount: bigint;
    rgbppTokenInfo: RgbppTokenInfo;
    witnessLockPlaceholderSize?: number;
    ckbFeeRate?: bigint;
    isMainnet: boolean;
    emptyCells: IndexerCell[];
    toCkbAddress: string;
}
export interface CollectConfig {
    isMax?: boolean;
    minCapacity?: bigint;
    errMsg?: string;
}
