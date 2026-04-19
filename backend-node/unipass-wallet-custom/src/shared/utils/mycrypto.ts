import moment from 'moment';
import { BadRequestException } from '@nestjs/common';
import { StatusName } from './status.msg.code';
import { verifyMessage } from 'ethers/lib/utils';

export function getFuzzyEmail(email: string | null | undefined): string {
    if (!email) {
        return '';
    }
    const emailData = email.split('@');
    const emailStart = emailData[0][0];
    const emailEnd = emailData[0][emailData[0].length - 1];
    if (email.includes('@')) {
        return `${emailStart}***${emailEnd}@${emailData[1]}`;
    }
    return `${emailStart}***${emailEnd}`;
}
export function sleep(t: number): Promise<void> {
    return new Promise((res) => setTimeout(res, t));
}
export async function verifySign(adminSig: any, rawData: any, adminAddress: any, redisService: any, logger: any, timestamp: any, Prefix?: any) {
    if (timestamp) {
        const diff = moment().diff(moment(timestamp * 1000), 's');
        if (diff > 60) {
            logger.warn(`[verifySign] timestamp ${timestamp} timeout now = ${moment().unix()} diff = ${diff}`);
            throw new BadRequestException(StatusName.AP_SIG_ERROR);
        }
    }
    const key = Prefix ? `${Prefix}:${adminSig}` : adminSig;
    const signInfo = await redisService.getCacheData(key);
    if (signInfo) {
        logger.warn('[verifySign] signature is used');
        throw new BadRequestException(StatusName.AP_SIG_ERROR);
    }
    try {
        const recoveredAddress = verifyMessage(rawData, adminSig);
        const isVerified = adminAddress.includes(recoveredAddress.toLowerCase());
        logger.log(`[verifySign] Prefix = ${Prefix}; adminSig=  ${adminSig}  adminAddress=${adminAddress},sigAddress = ${recoveredAddress.toLowerCase()} isVerified = ${isVerified}`);
        if (!isVerified) {
            throw new BadRequestException(StatusName.AP_SIG_ERROR);
        }
    }
    catch (error) {
        logger.warn(`[verifySign] error ${error}`);
        throw new BadRequestException(StatusName.AP_SIG_ERROR);
    }
}
export function verifyK1Sign(
    data: string | Uint8Array,
    signature: string,
    pubkey: string,
): boolean {
    const recoveredAddress = verifyMessage(data, signature);
    return recoveredAddress.toLowerCase() === pubkey.toLowerCase();
}
export function verifyWeb3AuthSignature(
    logger: { warn: (msg: string) => void },
    web3auth: { address: string; sig: string; message: string } | null | undefined,
): void {
    if (!web3auth) {
        return;
    }
    let isVerify = false;
    try {
        const { address, sig, message } = web3auth;
        isVerify = verifyK1Sign(message, sig, address);
    }
    catch (error) {
        logger.warn(`verifyWeb3AuthSignature error = ${error}`);
    }
    if (!isVerify) {
        logger.warn(`verifyWeb3AuthSignature isVerify = ${isVerify}`);
        throw new BadRequestException(StatusName.WEB3AUTH_ERROR);
    }
}
