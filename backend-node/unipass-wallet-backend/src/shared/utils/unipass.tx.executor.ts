import { CancelLockKeysetHashTxBuilder, SyncAccountTxBuilder, UpdateKeysetHashTxBuilder } from '@unipasswallet/transaction-builders';

export const optimalGasLimit = 2n ** 21n;
export function getAccountSubject(address: any, newKeysetHash: any, metaNonce: any) {
    const txBuilder = new UpdateKeysetHashTxBuilder(address, metaNonce, newKeysetHash, true);
    return txBuilder.digestMessage();
}
export function getCancelRecoveryBuilderDigestMessage(address: any, metaNonce: any) {
    const txBuilder = new CancelLockKeysetHashTxBuilder(address, metaNonce, true);
    return txBuilder.digestMessage();
}
export function getUpdateKeysetHashTxBuilderMessage(accountAddress: any, metaNonce: any, newKeysetHash: any) {
    const txBuilder = new UpdateKeysetHashTxBuilder(accountAddress, metaNonce, newKeysetHash, true);
    return txBuilder.digestMessage();
}
export function getSyncAccountDigestMessage(keysetHash: any, metaNonce: any, accountAddress: any, implementationAddress: any, timelockDuring: any) {
    metaNonce = metaNonce - 1;
    const txBuilder = new SyncAccountTxBuilder(accountAddress, metaNonce, keysetHash, timelockDuring, implementationAddress, true);
    return txBuilder.digestMessage();
}
