import { IntentType, Pool, PoolStatus } from './swap-types';
import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils';
import { append0x, remove0x, u128ToLe } from '@rgbpp-sdk/ckb';

export { PoolStatus };
export const CKB_TYPE_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const SWAP_EXACT_INPUT_FOR_OUTPUT_INTENT_ARGS_BUFFER_LENGTH = 56 + 1 + 1 + 16 + 16;
export const SWAP_INTENT_CELL_CAPACITY = BigInt(212 * 10 ** 8);
export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): [bigint, bigint, bigint] {
    const amountInWithFee = amountIn * BigInt(997);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * BigInt(1000) + amountInWithFee;
    const amountOut = numerator / denominator;
    return [amountOut, amountIn + reserveIn, reserveOut - amountOut];
}
export function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint): [bigint, bigint, bigint] {
    const numerator = reserveIn * amountOut * BigInt(1000);
    const denominator = (reserveOut - amountOut) * BigInt(997);
    const amountIn = numerator / denominator + BigInt(1);
    return [amountIn, amountIn + reserveIn, reserveOut - amountOut];
}
export function generateSwapIntentArgs(pool: Pool, fromLock: any, amountIn: bigint, amountOut: bigint, isXToY: boolean, slippage: bigint): string {
    const amountOutMin = (amountOut * (BigInt(1000) - slippage)) / BigInt(1000);
    const rawIntentArgs = {
        owner_lock_hash: append0x(scriptToHash(fromLock)),
        pool_type_hash: pool.typeHash,
        tx_fee: 0,
        expire_batch_id: 0,
        intent_type: IntentType.SwapExactInputForOutput,
        intent_data: {
            asset_in_index: isXToY ? 0 : 1,
            amount_in: amountIn,
            amount_out_min: amountOutMin,
        },
    };
    const swapTokenIntentBuffer = Buffer.alloc(SWAP_EXACT_INPUT_FOR_OUTPUT_INTENT_ARGS_BUFFER_LENGTH);
    let index = 0;
    swapTokenIntentBuffer.write(remove0x(rawIntentArgs.owner_lock_hash), index, 20, 'hex');
    index += 20;
    swapTokenIntentBuffer.write(remove0x(rawIntentArgs.pool_type_hash), index, 20, 'hex');
    index += 20;
    swapTokenIntentBuffer.write(rawIntentArgs.tx_fee.toString(16), index, 8, 'hex');
    index += 8;
    swapTokenIntentBuffer.write(rawIntentArgs.expire_batch_id.toString(16), index, 8, 'hex');
    index += 8;
    // BUG-19 fix: Removed console.log statements that could leak internal transaction data in production
    swapTokenIntentBuffer.writeUint8(rawIntentArgs.intent_type, index);
    index += 1;
    swapTokenIntentBuffer.writeUInt8(rawIntentArgs.intent_data.asset_in_index, index);
    index += 1;
    swapTokenIntentBuffer.write(u128ToLe(rawIntentArgs.intent_data.amount_in), index, 16, 'hex');
    index += 16;
    // BUG-16 fix: Removed duplicate write of amount_out_min that caused buffer overflow
    swapTokenIntentBuffer.write(u128ToLe(rawIntentArgs.intent_data.amount_out_min), index, 16, 'hex');
    index += 16;
    return append0x(swapTokenIntentBuffer.toString('hex'));
}
