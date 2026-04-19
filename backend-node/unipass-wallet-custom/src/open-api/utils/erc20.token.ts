import { aggregate } from 'makerdao-multicall';
import { utils } from 'ethers';

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';
export const chainErc20Config = {
    137: {
        [exports.NATIVE_TOKEN_ADDRESS]: {
            symbol: 'MATIC',
            decimals: 18,
            cid: 3890,
        },
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': {
            symbol: 'USDT',
            decimals: 6,
            cid: 825,
        },
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': {
            symbol: 'USDC',
            decimals: 6,
            cid: 3408,
        },
    },
    42161: {
        [exports.NATIVE_TOKEN_ADDRESS]: {
            symbol: 'ETH',
            decimals: 18,
            cid: 1027,
        },
        '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': {
            symbol: 'USDT',
            decimals: 6,
            cid: 825,
        },
        '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': {
            symbol: 'USDC',
            decimals: 6,
            cid: 3408,
        },
    },
    43114: {
        [exports.NATIVE_TOKEN_ADDRESS]: {
            symbol: 'AVAX',
            decimals: 18,
            cid: 5805,
        },
        '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': {
            symbol: 'USDT',
            decimals: 6,
            cid: 825,
        },
        '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': {
            symbol: 'USDC',
            decimals: 6,
            cid: 3408,
        },
    },
    80001: {
        [exports.NATIVE_TOKEN_ADDRESS]: {
            symbol: 'MATIC',
            decimals: 18,
            cid: 3890,
        },
        '0x569F5fF11E259c8e0639b4082a0dB91581a6b83e': {
            symbol: 'USDT',
            decimals: 6,
            cid: 825,
        },
        '0x87F0E95E11a49f56b329A1c143Fb22430C07332a': {
            symbol: 'USDC',
            decimals: 6,
            cid: 3408,
        },
    },
    97: {
        [exports.NATIVE_TOKEN_ADDRESS]: {
            symbol: 'tBNB',
            decimals: 18,
            cid: 1839,
        },
        '0x64544969ed7EBf5f083679233325356EbE738930': {
            symbol: 'USDC',
            decimals: 18,
            cid: 3408,
        },
    },
};
export const getSupportChainIdList = () => {
    let chainList = [];
    for (let key in chainErc20Config) {
        if (Object.prototype.hasOwnProperty.call(chainErc20Config, key)) {
            chainList.push(Number(key));
        }
    }
    return chainList;
};
export const getBalancesByMulticall = async (
    chainId: number,
    accountAddress: string,
    contractAddress: string,
    multicallAddress: string,
    rpcUrl: string,
) => {
    let calls: any[] = [];
    const erc20Config = (chainErc20Config as Record<number, Record<string, { decimals: number }>>)[chainId][contractAddress];
    calls =
        contractAddress === NATIVE_TOKEN_ADDRESS
            ? [
                {
                    target: multicallAddress,
                    call: ['getEthBalance(address)(uint256)', accountAddress],
                    returns: [[contractAddress, (val: unknown) => val]],
                },
            ]
            : [
                {
                    target: contractAddress,
                    call: ['balanceOf(address)(uint256)', accountAddress],
                    returns: [[contractAddress, (val: unknown) => val]],
                },
            ];
    const ret = await aggregate(calls, {
        rpcUrl,
        multicallAddress,
    });
    const balance = Number(utils.formatUnits(ret.results.transformed[contractAddress], erc20Config.decimals));
    return balance;
};
