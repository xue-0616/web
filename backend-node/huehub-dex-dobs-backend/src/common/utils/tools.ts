import Decimal from 'decimal.js';
import { bitcoin, ecc } from '@rgbpp-sdk/btc';
import { ItemStatus } from '../../database/entities';
import { ShowItemLoadingStatus } from '../../modules/collection/dto/items.output.dto';
import { BTC_DECIMAL } from './const.config';
import { BIP32Factory } from 'bip32';

export function sleep(t: any) {
    return new Promise((res) => setTimeout(res, t));
}
export function isArraysIdentical(arr1: any, arr2: any) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();
    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) {
            return false;
        }
    }
    return true;
}
export function getFloorPriceForItem(itemPrice: any, tokenAmount: any, decimals: any) {
    return itemPrice.div(tokenAmount.div(Decimal.pow(10, decimals)));
}
export function convertTokenPriceToUSDPrice(btcPrice: any, tokenPrice: any) {
    if (!tokenPrice) {
        return new Decimal(0);
    }
    return tokenPrice.mul(btcPrice.div(Decimal.pow(10, BTC_DECIMAL)));
}
export function getUSDValueForSatoshi(satoshiAmount: any, btcUsdPrice: any) {
    return satoshiAmount.div(Decimal.pow(10, BTC_DECIMAL)).mul(btcUsdPrice);
}
export const schnorrValidator = (pubkey: any, msghash: any, signature: any) => {
    try {
        return ecc.verifySchnorr(msghash, pubkey, signature);
    }
    catch (error) {
        return false;
    }
};
export const eccValidator = (pubkey: any, msghash: any, signature: any) => {
    try {
        return ecc.verify(msghash, pubkey, signature);
    }
    catch (error) {
        return false;
    }
};
export const psbtValidator = (pubkey: any, msghash: any, signature: any) => {
    return (exports.schnorrValidator(pubkey, msghash, signature) ||
        exports.eccValidator(pubkey, msghash, signature));
};
export function isNullOrUndefined(value: any) {
    return value === undefined || value === null;
}
export const generateHdWallet = (seed: any, network: any, id: any) => {
    const bip32 = BIP32Factory(ecc);
    const root = bip32.fromSeed(Buffer.from(seed, 'hex'), network);
    const path = `m/44'/0'/0'/0/${id}`;
    const child = root.derivePath(path);
    const { address } = bitcoin.payments.p2wpkh({
        pubkey: child.publicKey,
        network,
    });
    return address;
};
export const toCamelCase = (obj: any) => {
    if (Array.isArray(obj)) {
        return obj.map((v) => exports.toCamelCase(v));
    }
    else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => ({
            ...result,
            [key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())]: exports.toCamelCase(obj[key]),
        }), {});
    }
    return obj;
};
export const getUxtoInfoByLockArgs = (args: any) => {
    let index = parseInt(args.slice(0, 10).replace(/(00)+$/, ''), 16);
    const txidStr = args.slice(10);
    if (txidStr.length % 2 !== 0) {
        throw new Error('args length not match');
    }
    const matched = txidStr.match(/.{1,2}/g);
    if (matched === null) {
        throw new Error('args length not match');
    }
    const txid = matched.reverse().join('');
    return { index, txid };
};
export const formatDobsMediaUrl = (dobsMediaHost: any, mediaType: any, prevBg: any) => {
    if (!prevBg || !mediaType) {
        return null;
    }
    if (!prevBg.startsWith('btcfs://')) {
        return null;
    }
    if (mediaType === 'image/png') {
        return `${dobsMediaHost}/${prevBg.slice(8).split('i0')[0]}.png`;
    }
    return null;
};
export function itemStatusToShowItemStatus(status: any) {
    switch (status) {
        case ItemStatus.Pending:
            return ShowItemLoadingStatus.Loading;
        default:
            return ShowItemLoadingStatus.Complete;
    }
}
