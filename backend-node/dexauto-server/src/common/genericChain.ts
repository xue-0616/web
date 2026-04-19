import { BadRequestException } from '@nestjs/common';

export enum Chain {
    Evm = 0,
    Solana = 1,
}
export function chainFromStr(s: any) {
    switch (s) {
        case 'Ethereum': {
            return Chain.Evm;
        }
        case 'Solana': {
            return Chain.Solana;
        }
        default: {
            throw new BadRequestException('invalid chain');
        }
    }
}
export enum ChainId {
    Ethereum = 1,
}
export class GenericChain {
    chain: Chain;
    chainId?: ChainId;
    constructor(chain: Chain, chainId?: ChainId | undefined) {
        this.chain = chain;
        this.chainId = chainId;
        if (chain === Chain.Evm && chainId === null) {
            throw new BadRequestException('invalid chain');
        }
    }
}
export const SUPPORTED_CHAINS = [Chain.Evm, Chain.Solana];
export const SUPPORTED_EVM_CHAIN_IDS = [ChainId.Ethereum];
