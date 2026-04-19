import { Wallet } from 'ethers';
import { getBytes, solidityPacked } from 'ethers';
import { getPermitMessage } from '../shared/utils';

export enum SigFlag {
    EIP712 = 1,
    EthSig = 2,
}
export async function encryptMasterKey(privkey: string, password: string): Promise<string> {
    const w = new Wallet(privkey);
    const encryptedWallet = await w.encrypt(password);
    return encryptedWallet;
}
export async function decryptMasterKey(keystore: string, password: string): Promise<string> {
    const w = await Wallet.fromEncryptedJson(keystore, password);
    return w.privateKey;
}
export async function signMsg(msg: string, privkey: string): Promise<string> {
    const w = new Wallet(privkey);
    const sig = await w.signMessage(getBytes(msg));
    return sig;
}
export async function signBufferMsg(msg: Uint8Array | string, privkey: string): Promise<string> {
    const w = new Wallet(privkey);
    const sig = await w.signMessage(msg);
    return sig;
}
export const generatePermit = async (sessionKeyAddress: string, timestamp: number, weight: number, userAddr: string, materKeyPrivkey: string): Promise<string> => {
    const permitMessage = getPermitMessage(sessionKeyAddress, timestamp, weight, userAddr);
    const sig = await signMsg(permitMessage, materKeyPrivkey);
    const permit = solidityPacked(['bytes', 'uint16'], [sig, SigFlag.EthSig]);
    return permit;
};
