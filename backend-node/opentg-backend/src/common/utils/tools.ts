import 'dotenv/config';
import Sqids from 'sqids';

export function sleep(t: number) {
    return new Promise((res) => setTimeout(res, t));
}
export function isArraysIdentical(arr1: any[], arr2: any[]) {
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
export const toCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map((v) => toCamelCase(v));
    }
    else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => ({
            ...result,
            [key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())]: toCamelCase(obj[key]),
        }), {});
    }
    return obj;
};
const ALPHABET = process.env.InviteAlphaBet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const sqidsInstance = new Sqids({
    alphabet: ALPHABET,
    minLength: Number(process.env.InviteCodeLen) || 8,
});
export const generateInviteCode = (userId: number): string => {
    const randomNumbers = [userId, Math.floor(Math.random() * 1e8)];
    const code = sqidsInstance.encode(randomNumbers);
    return code.slice(0, 8);
};
