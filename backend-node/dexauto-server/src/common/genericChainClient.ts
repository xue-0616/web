import { ethers } from 'ethers';
import { Chain, ChainId, GenericChain } from './genericChain';
import { web3 } from '@coral-xyz/anchor';
import { assertNever } from './utils';

export type ChainRpcUrls = {
    solana?: string;
    ethereum?: string;
};

export class GenericChainClient {
    private genericChain: GenericChain;
    private client: any;

    constructor(genericChain: GenericChain, urls: ChainRpcUrls) {
        this.genericChain = genericChain;
        switch (this.genericChain.chain) {
            case Chain.Evm: {
                switch (this.genericChain.chainId) {
                    case ChainId.Ethereum: {
                        const url = urls.ethereum;
                        if (url === undefined) {
                            throw new Error('expected solana url');
                        }
                        this.client = new ethers.JsonRpcProvider(url);
                        break;
                    }
                    default: {
                        throw new Error('invalid chain id');
                    }
                }
                break;
            }
            case Chain.Solana: {
                const url = urls.solana;
                if (url === undefined) {
                    throw new Error('expected solana url');
                }
                this.client = new web3.Connection(url);
                break;
            }
            default: {
                assertNever(this.genericChain.chain);
            }
        }
    }
}
