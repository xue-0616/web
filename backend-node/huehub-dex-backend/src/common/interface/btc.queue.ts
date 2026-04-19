import { RgbppTokenInfo } from '@rgbpp-sdk/ckb';
import { RgbppLaunchVirtualTxResult } from '../utils/launch.interface';
export interface BtcQueueJobData {
    orderId: number;
    btcTxHash: string;
    queryTime?: number;
}
export interface BtcLaunchQueueJobData {
    deployTokenId: number;
    btcTxHash: string;
    queryTime?: number;
    ckbVirtualTxResult: RgbppLaunchVirtualTxResult;
    rgbppTokenInfo: RgbppTokenInfo;
}
export interface LaunchpadStatusJobData {
    mintHistoryId: number;
    btcTxHash?: string;
    queryTime?: number;
}
