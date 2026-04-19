// Recovered from dist/utils.js.map (source: ../../../src/shared/utils/utils.ts)

export function sleep(t: number): Promise<void> {
    return new Promise((res) => setTimeout(res, t));
}

export function generateOtpCode(length = 4): string {
    const result = [];
    const characters = '0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        const random = Math.floor(Math.random() * charactersLength);
        result.push(characters.charAt(random));
    }
    return result.join('');
}

export const encodeBase64 = (text: string): string => Buffer.from(text).toString('base64');

export const decodeBase64 = (text: string): string => Buffer.from(text, 'base64').toString();
