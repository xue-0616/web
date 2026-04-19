import Sqids from 'sqids';
import { encode } from 'bs58';

require("dotenv/config");
export function sleep(t: number): Promise<void> {
    return new Promise((res) => setTimeout(res, t));
}
export function isArraysIdentical<T>(arr1: T[], arr2: T[]): boolean {
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
export const toCamelCase = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
        return obj.map((v) => toCamelCase(v));
    }
    else if (obj !== null && (obj as any).constructor === Object) {
        const o = obj as Record<string, unknown>;
        return Object.keys(o).reduce<Record<string, unknown>>((result, key) => ({
            ...result,
            [key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())]: toCamelCase(o[key]),
        }), {});
    }
    return obj;
};
export const extractAllUrls = (msgText: string): string[] => {
    const urlPattern = /(https?:\/\/[^\s]+(?:https?:\/\/[^\s]+)?)/g;
    const matches = msgText.match(urlPattern);
    return matches ? Array.from(new Set(matches)) : [];
};
export const encodeBase58 = (jsonString: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonString);
    const base58String = encode(bytes);
    return base58String;
};
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const sqids = new Sqids({
    alphabet: ALPHABET,
    minLength: 8,
});
export const generateShortCode = (length: number): string => {
    const randomNumbers = [length, Math.floor(Math.random() * 1e8)];
    let code = sqids.encode(randomNumbers);
    return code.slice(0, 8);
};
