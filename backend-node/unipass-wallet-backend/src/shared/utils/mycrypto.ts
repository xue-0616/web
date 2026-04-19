import { BadRequestException } from '@nestjs/common';
import { StatusName } from './status.msg.code';
import { getBytes, concat, toUtf8Bytes, verifyMessage } from 'ethers';
import { createHash } from 'crypto';
import { toDataURL } from 'qrcode';
// ethers v6: BigNumber removed — use native BigInt

export const suffixes = [
    'gmail.com',
    'googlemail.com',
    'hotmail.com',
    'mail.com',
    'icloud.com',
    'outlook.com',
    'protonmail.com',
    'pm.me',
    'yahoo.com',
    'qq.com',
    'foxmail.com',
    '163.com',
    '126.com',
    'yeah.net',
    'vip.163.com',
    'vip.126.com',
    '188.com',
    'vip.188.com',
];
export const snapSuffixes = ['unipass.id', 'consensys.net'];
export function isMatchDkimEmailSuffixes(email: any, logger: any) {
    const emailSuffixes = email.split('@')[1];
    const supportSuffixes = [...exports.suffixes, ...exports.snapSuffixes];
    if (!supportSuffixes.includes(emailSuffixes)) {
        logger.error(`[matchEmailFormat] email not match dkim  email Format= ${email}`);
        throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
    }
}
export function getFuzzyEmail(email: any) {
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
export function getFuzzyPhone(phone: any, areaCode: any) {
    const phoneStart = phone.slice(0, 3);
    const phoneEnd = phone.slice(-2, phone.length);
    return `${areaCode}-${phoneStart}***${phoneEnd}`;
}
export function getFuzzyGa(base32: any) {
    const base32Start = base32.slice(0, 3);
    const base32End = base32.slice(-2, base32.length);
    return ` ${base32Start}***${base32End}`;
}
export function formatEmail(email: any) {
    if (!email) {
        return '';
    }
    const lowerArray = [
        'gmail.com',
        'googlemail.com',
        'yahoo.com',
        'qq.com',
        'foxmail.com',
        '163.com',
        '126.com',
        'yeah.net',
        'vip.163.com',
        'vip.126.com',
        '188.com',
        'vip.188.com',
        'icloud.com',
    ];
    let emailData = email.split('@');
    if (lowerArray.includes(emailData[1].toLocaleLowerCase())) {
        email = email.toLocaleLowerCase().trim();
    }
    emailData = email.split('@');
    let prefix = emailData[0].split('+')[0];
    const pointArray = ['gmail.com', 'googlemail.com', 'protonmail.com', 'pm.me'];
    if (!pointArray.includes(emailData[1])) {
        return `${prefix}@${emailData[1]}`;
    }
    const reg = new RegExp(/\.+/, 'g');
    prefix = prefix.trim().replace(reg, '');
    return `${prefix}@${emailData[1]}`;
}
export function frontEndFormatEmail(email: any) {
    if (!email) {
        return '';
    }
    const lowerArray = [
        'gmail.com',
        'googlemail.com',
        'yahoo.com',
        'qq.com',
        'foxmail.com',
        '163.com',
        '126.com',
        'yeah.net',
        'vip.163.com',
        'vip.126.com',
        '188.com',
        'vip.188.com',
        'icloud.com',
    ];
    let emailData = email.split('@');
    if (lowerArray.includes(emailData[1].toLocaleLowerCase())) {
        email = email.toLocaleLowerCase().trim();
    }
    emailData = email.split('@');
    const prefix = emailData[0].split('+')[0];
    return `${prefix}@${emailData[1]}`;
}
function isUpper(str: any) {
    return /[A-Z]/.test(str);
}
export function matchEmailFormat(email: any, logger: any) {
    if (email.includes('+')) {
        logger.error(`[matchEmailFormat] email not match Email Format email= ${email}`);
        throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
    }
    const lowerArray = [
        'gmail.com',
        'googlemail.com',
        'yahoo.com',
        'qq.com',
        'foxmail.com',
        '163.com',
        '126.com',
        'yeah.net',
        'vip.163.com',
        'vip.126.com',
        '188.com',
        'vip.188.com',
        'icloud.com',
    ];
    const emailData = email.split('@');
    try {
        if (lowerArray.includes(emailData[1].toLocaleLowerCase()) &&
            isUpper(emailData[0])) {
            throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
        }
        return true;
    }
    catch (_a) {
        throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
    }
}
export const encodeBase64 = (text: any) => Buffer.from(text).toString('base64');
export const decodeBase64 = (text: any) => Buffer.from(text, 'base64').toString();
export function sleep(t: any) {
    return new Promise((res) => setTimeout(res, t));
}
export function verifyK1Sign(data: any, signature: any, pubkey: any) {
    const recoveredAddress = verifyMessage(data, signature);
    return recoveredAddress.toLowerCase() === pubkey.toLowerCase();
}
export function sha256Hash(email: any, pepper: any) {
    if (!email) {
        return '';
    }
    email = frontEndFormatEmail(email);
    const data = concat([toUtf8Bytes(email), getBytes(pepper)]);
    const hash = createHash('sha256').update(data).digest('hex');
    return `0x${hash}`;
}
export function generateOtpCode(length = 4) {
    const result = [];
    const characters = '0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        const random = Math.floor(Math.random() * charactersLength);
        result.push(characters.charAt(random));
    }
    return result.join('');
}
export async function getQrData(pathUrl: any) {
    const promise = new Promise(function (resolve, reject) {
        toDataURL(pathUrl, function (err: any, data_url: any) {
            if (err) {
                reject(err);
            }
            if (data_url) {
                resolve(data_url);
            }
        });
    });
    return promise;
}
export function getAlchemyNodename(chainId: any) {
    let nodeName = '';
    switch (chainId) {
        case '137':
            nodeName = 'polygon-mainnet';
            break;
        case '80001':
            nodeName = 'polygon-mumbai';
            break;
        case '42161':
            nodeName = 'arb-mainnet';
            break;
        case '421613':
            nodeName = 'arb-goerli';
            break;
        case '5':
            nodeName = 'eth-goerli';
            break;
        case '1':
            nodeName = 'eth-mainnet';
            break;
        default:
            nodeName = '';
            break;
    }
    return nodeName;
}
export function filterErc20List(tokenLIst: any) {
    const list = [];
    for (const item of tokenLIst) {
        const { tokenBalance } = item;
        const contractAddress = item.tokenAddress
            ? item.tokenAddress
            : item.contractAddress;
        if (String(BigInt(tokenBalance)) === '0') {
            continue;
        }
        const tokenInfo = {
            contract_address: contractAddress,
            balance: BigInt(tokenBalance).toString(16),
        };
        list.push(tokenInfo);
    }
    return list;
}
