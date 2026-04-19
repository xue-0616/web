import { getUnipassWalletContext } from './wallet';
// ethers v6: BigNumber removed — use native BigInt
import { digestGuestTxHash, digestTxHash } from '@unipasswallet/transactions';
import { keccak256, solidityPacked } from 'ethers';

export enum SigPrefix {
    PREFIX = "apSig",
    LOCK = "Lock",
    DEDUCT = "Deduct",
}

export enum BigIntValue {
    zero = "0",
    maxValue = "9223372036854775807",
    minValue = "-9223372036854775808",
    maxValueUnsigned = "18446744073709551615",
}
export const handleWarnError = (funcName: any, error: any, logger: any) => {
    logger.warn(`[${funcName}] ${error}`);
};
export const getTxSigRawData = (chainId: any, address: any, nonce: any, ap: any, txs: any, timestamp: any) => {
    const moduleGuestAddress = getUnipassWalletContext().moduleGuest;
    const transactions = txs.map((tx: any) => {
        const transaction = {
            _isUnipassWalletTransaction: true,
            callType: tx.callType,
            data: tx.data,
            revertOnError: tx.revertOnError,
            gasLimit: BigInt(tx.gasLimit),
            target: tx.target,
            value: BigInt(tx.value),
        };
        return transaction;
    });
    const digestHash = moduleGuestAddress.toLowerCase() === address.toLowerCase()
        ? digestGuestTxHash(chainId, address, transactions)
        : digestTxHash(chainId, address, nonce, transactions);
    const rawData = keccak256(solidityPacked(['bytes', 'uint64', 'uint32'], [digestHash, ap, timestamp]));
    return rawData;
};
