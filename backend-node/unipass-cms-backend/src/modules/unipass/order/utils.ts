import { createSign, createVerify } from 'crypto';

export const sortRequestParameters = (requestParameters: Record<string, any> = {}, toLowerCase = false) => {
    const sortedJson: Record<string, any> = {};
    const sortedKeys = Object.keys(requestParameters).sort();
    for (const item of sortedKeys) {
        if (toLowerCase) {
            sortedJson[item.toLowerCase()] = requestParameters[item];
        } else {
            sortedJson[item] = requestParameters[item];
        }
    }
    return sortedJson;
};

const buildSignatureString = (method: string, requestParameters: Record<string, any> = {}) => {
    const needSignatureList: string[] = [];
    for (const key of Object.keys(requestParameters)) {
        needSignatureList.push(`${key}=${requestParameters[key]}`);
    }
    return method + needSignatureList.join('&');
};

export const signatureFatPay = (method: string, requestParameters: Record<string, any> = {}, privatekey: string) => {
    const signatureStr = buildSignatureString(method, requestParameters);
    const signer = createSign('RSA-SHA256');
    signer.update(signatureStr);
    signer.end();
    return signer.sign(privatekey, 'base64');
};

export class RequestContext {
    requestID?: string;
    url?: string;
    ip?: string;
    headers?: Record<string, any>;
}

export class FatPayHeaderInfo {
    'X-Fp-Version'?: string;
    'X-Fp-Timestamp'?: string | number;
    'X-Fp-Nonce'?: string | number;
    'X-Fp-Partner-Id'?: string;
    'X-Fp-Signature'?: string;
}

export const verifyFatPaySignature = (method: string, requestParameters: Record<string, any> = {}, privatekey: string, signature: string) => {
    const signatureStr = buildSignatureString(method, requestParameters);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(signatureStr);
    verifier.end();
    return verifier.verify(privatekey, signature, 'base64');
};
