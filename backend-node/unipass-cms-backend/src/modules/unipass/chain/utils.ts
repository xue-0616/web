import { promises as dns } from 'node:dns';
import { decodeBytes32String } from 'ethers';

export type BlockTag = string | number;

export interface ITokenData {
  symbol: string;
  decimals: number;
  cid: number;
}

type ChainTokenMap = Record<string, ITokenData>;

type WalletContext = {
  moduleGuest: string;
  moduleMain: string;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const MAINNET_UNIPASS_WALLET_CONTEXT: WalletContext = {
  moduleGuest: process.env.UNIPASS_MODULE_GUEST ?? ZERO_ADDRESS,
  moduleMain: process.env.UNIPASS_MODULE_MAIN ?? ZERO_ADDRESS,
};

const TESTNET_UNIPASS_WALLET_CONTEXT: WalletContext = {
  moduleGuest: process.env.UNIPASS_TEST_MODULE_GUEST ?? MAINNET_UNIPASS_WALLET_CONTEXT.moduleGuest,
  moduleMain: process.env.UNIPASS_TEST_MODULE_MAIN ?? MAINNET_UNIPASS_WALLET_CONTEXT.moduleMain,
};

export function getUnipassWalletContext(isTestNet = false): WalletContext {
  return isTestNet ? TESTNET_UNIPASS_WALLET_CONTEXT : MAINNET_UNIPASS_WALLET_CONTEXT;
}

export const NATIVE_TOKEN_ADDRESS = ZERO_ADDRESS;

export const nativeToken: Record<string, ChainTokenMap> = {
  '1': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'ETH', decimals: 18, cid: 1027 },
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': { symbol: 'USDT', decimals: 6, cid: 825 },
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': { symbol: 'USDC', decimals: 6, cid: 3408 },
  },
  '137': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'MATIC', decimals: 18, cid: 3890 },
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': { symbol: 'USDT', decimals: 6, cid: 825 },
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': { symbol: 'USDC.e', decimals: 6, cid: 3408 },
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359': { symbol: 'USDC', decimals: 6, cid: 3408 },
  },
  '56': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'BNB', decimals: 18, cid: 1839 },
    '0x55d398326f99059fF775485246999027B3197955': { symbol: 'USDT', decimals: 18, cid: 825 },
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': { symbol: 'USDC', decimals: 18, cid: 3408 },
  },
  '2025': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'RPG', decimals: 18, cid: 11978 },
    '0x8E8816a1747fDDC5F8B45d2e140a425D3788f659': { symbol: 'USDT', decimals: 18, cid: 825 },
  },
  '42161': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'ETH', decimals: 18, cid: 1027 },
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': { symbol: 'USDT', decimals: 6, cid: 825 },
    '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': { symbol: 'USDC', decimals: 6, cid: 3408 },
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': { symbol: 'USDC.e', decimals: 6, cid: 3408 },
  },
  '43114': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'AVAX', decimals: 18, cid: 5805 },
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': { symbol: 'USDT', decimals: 6, cid: 825 },
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': { symbol: 'USDC', decimals: 6, cid: 3408 },
  },
  '321': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'KCS', decimals: 18, cid: 10908 },
    '0x0039f574eE5cC39bdD162E9A88e3EB1f111bAF48': { symbol: 'USDT', decimals: 18, cid: 825 },
    '0x980a5AfEf3D17aD98635F6C5aebCBAedEd3c3430': { symbol: 'USDC', decimals: 18, cid: 3408 },
  },
  '210425': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'LAT', decimals: 18, cid: 9720 },
    '0x97003a080D320eA015BEDba30df25e65Dc32164f': { symbol: 'USDT', decimals: 6, cid: 825 },
    '0x81ECac0D6Be0550A00FF064a4f9dd2400585FE9c': { symbol: 'USDC', decimals: 6, cid: 3408 },
  },
  '66': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'OKT', decimals: 18, cid: 8267 },
    '0x382bB369d343125BfB2117af9c149795C6C65C50': { symbol: 'USDT', decimals: 18, cid: 825 },
    '0xc946DAf81b08146B1C7A8Da2A851Ddf2B3EAaf85': { symbol: 'USDC', decimals: 18, cid: 3408 },
  },
  '5': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'ETH', decimals: 18, cid: 1027 },
    '0xd44BB808bfE43095dBb94c83077766382D63952a': { symbol: 'USDT', decimals: 6, cid: 825 },
    '0x365E05Fd986245d14c740c139DF8712AD8807874': { symbol: 'USDC', decimals: 6, cid: 3408 },
  },
  '80001': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'MATIC', decimals: 18, cid: 3890 },
    '0x569F5fF11E259c8e0639b4082a0dB91581a6b83e': { symbol: 'USDT', decimals: 6, cid: 825 },
    '0x87F0E95E11a49f56b329A1c143Fb22430C07332a': { symbol: 'USDC', decimals: 6, cid: 3408 },
  },
  '97': {
    [NATIVE_TOKEN_ADDRESS]: { symbol: 'tBNB', decimals: 18, cid: 1839 },
    '0x64544969ed7EBf5f083679233325356EbE738930': { symbol: 'USDC', decimals: 18, cid: 3408 },
    '0x2877261510301aBA7F999AbDD88bFD4cB8FC4D4a': { symbol: 'USDC', decimals: 18, cid: 3408 },
    '0xC44D3fF64A63C59bdd5d5f5C56E7C699beD2EEA2': { symbol: 'USDT', decimals: 18, cid: 825 },
  },
};

const chainIds = {
  bsc: ['56', '97'],
  polygon: ['137', '80001'],
  arb: ['42161', '421613'],
};

export function getChainName(chainId: string): string | undefined {
  if (chainIds.bsc.includes(chainId)) {
    return 'bsc';
  }
  if (chainIds.polygon.includes(chainId)) {
    return 'polygon';
  }
  if (chainIds.arb.includes(chainId)) {
    return 'arb';
  }
  return undefined;
}

export function sortList<T extends { date?: string | Date; app?: string }>(list: T[]): T[] {
  return list.sort((a, b) => {
    const appA = a.app ?? '';
    const appB = b.app ?? '';
    const appComparison = appA.localeCompare(appB);
    if (appComparison !== 0) {
      return appComparison;
    }
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeA - timeB;
  });
}

export function getTokenAmount(token: number): number {
  return Math.floor(token * 1_000_000) / 1_000_000;
}

export function getUsdAmount(usd: number): number {
  return Math.floor(usd * 100) / 100;
}

export function parseOpenIdData(data: string): { publicKey: string; mapKey: string } {
  let mapKey = data;
  let publicKey = '';
  if (data.length >= 195) {
    mapKey = data.slice(0, 66);
    publicKey = `0x${data.slice(194)}`;
  }
  return { publicKey, mapKey };
}

export function parseDkimKeyData(data: string): { publicKey: string; emailServer: string; selector: string; sdid: string } {
  const emailServer = `0x${data.slice(194, 322)}`;
  const selector = safeParseBytes32String(`0x${(emailServer.slice(2, 66) || '').padEnd(64, '0')}`);
  const sdid = safeParseBytes32String(`0x${(emailServer.slice(66) || '').padEnd(64, '0')}`);
  const publicKey = data.length >= 386 ? `0x${data.slice(386)}` : '';
  return { publicKey, emailServer, selector, sdid };
}

function safeParseBytes32String(value: string): string {
  try {
    return decodeBytes32String(value);
  } catch {
    return '';
  }
}

export async function getDnsInfo(hostname: string): Promise<{ hostname: string; dkimInfo: string; publicKey: string }> {
  try {
    const records = await dns.resolveTxt(hostname);
    if (records.length === 0) {
      return { hostname, dkimInfo: 'queryTxt ENOTFOUND', publicKey: '' };
    }
    const dkimInfo = records[0].join('');
    const publicKey = dkimInfo.split('p=')[1]?.trim().split(';')[0] ?? '';
    return { hostname, dkimInfo, publicKey };
  } catch {
    return { hostname, dkimInfo: 'queryTxt ENOTFOUND', publicKey: '' };
  }
}

export function getOpenIdKeyInfo(keys: Array<{ kid: string; n: string }>, certsUrl: string): Array<{ publicKey: string; kid: string; certsUrl: string }> {
  return keys.map((item) => ({
    publicKey: `0x${Buffer.from(item.n, 'base64').toString('hex')}`,
    kid: item.kid,
    certsUrl,
  }));
}

export function formatKeysetInfo(keysetRaw: string): string {
  return keysetRaw || '';
}

export function sleep(t: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, t));
}
