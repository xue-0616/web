import Node_rsa from 'node-rsa';
import { createCipheriv, createHmac } from 'crypto';

export const sortRequestParameters = (requestParameters: Record<string, any> = {}) => {
    const sortedJson: Record<string, any> = {};
    const sortedKeys = Object.keys(requestParameters).sort();
    for (const item of sortedKeys) {
        sortedJson[item] = requestParameters[item];
    }
    return sortedJson;
};
export const signatureFatPay = (secretKey: any, requestParameters: Record<string, any> = {}) => {
    const needSignatureList = [];
    for (const key in requestParameters) {
        const value = requestParameters[key];
        needSignatureList.push(`${key}=${value}`);
    }
    const signatureStr = needSignatureList.join('&');
    const base64str = createHmac('sha256', secretKey)
        .update(signatureStr)
        .digest('base64');
    return base64str;
};
function alchemyPayEncrypt(signatureStr: any, secretKeyData: any) {
    const plainTextData = Buffer.from(signatureStr, 'utf8');
    const secretKey = Buffer.from(secretKeyData, 'utf8');
    const iv = secretKeyData.slice(0, 16);
    const cipher = createCipheriv('aes-128-cbc', secretKey, iv);
    let encrypted = cipher.update(plainTextData);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('base64');
}
export const signatureAlchemyPay = (secretKey: any, requestParameters: Record<string, any> = {}) => {
    const needSignatureList = [];
    for (const key in requestParameters) {
        const value = requestParameters[key];
        needSignatureList.push(`${key}=${value}`);
    }
    const signatureStr = needSignatureList.join('&');
    const signature = alchemyPayEncrypt(signatureStr, secretKey);
    return signature;
};
export function extractPubkey2(privaKey: any) {
    const data = privaKey.exportKey('components-private');
    const e = data.e.toString(16).padStart(8, '0');
    const n = data.n.slice(1);
    const size = n.length * 8;
    const sizeVec = Buffer.alloc(4);
    sizeVec.writeUInt32LE(size, 0);
    const eVec = Buffer.from(e, 'hex').reverse();
    const nVec = n.reverse();
    const pubKey = Buffer.concat([sizeVec, eVec, nVec]);
    return pubKey.toString('hex');
}
export function getNetworkByChainId(chain: string) {
    const network: Record<string, { network: string }> = {
        bsc: { network: 'BSC' },
        eth: { network: 'ETH' },
        polygon: { network: 'MATIC' },
        arbitrum: { network: 'ARBITRUM' },
    };
    try {
        return network[chain];
    }
    catch (_a) {
        return {};
    }
}
export function getBinanceConnectNetworkByChainId(chain: string) {
    const network: Record<string, { network: string; cryptoCurrency: string }> = {
        bsc: { network: 'BSC', cryptoCurrency: 'BNB' },
        eth: { network: 'ETH', cryptoCurrency: 'ETH' },
        polygon: { network: 'MATIC', cryptoCurrency: 'MATIC' },
        arbitrum: { network: 'ARBITRUM', cryptoCurrency: 'ETH' },
    };
    try {
        return network[chain];
    }
    catch (_a) {
        return {};
    }
}
export function generateBnbRsaKey() {
    const key = new Node_rsa({ b: 1024 });
    key.setOptions({ signingScheme: 'pkcs1-sha256' });
    const publicKey = key.exportKey('pkcs8-public');
    const privateKey = key.exportKey('pkcs8-private');
    return { key, publicKey, privateKey };
}
export const binanceApiGetSign = (requestParameters: Record<string, any> = {}, pem: any) => {
    const needSignatureList = [];
    for (const key in requestParameters) {
        const value = requestParameters[key];
        needSignatureList.push(`${key}=${value}`);
    }
    const signatureStr = needSignatureList.join('&');
    const key = new Node_rsa(pem);
    key.setOptions({ signingScheme: 'pkcs1-sha256' });
    const sign = key.sign(Buffer.from(signatureStr), 'base64');
    return sign;
};
