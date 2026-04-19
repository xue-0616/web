import { Chain } from './genericChain';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import { web3 } from '@coral-xyz/anchor';
import { assertNever } from './utils';

export class GenericPrivateKey {
    chain: Chain;
    privateKey!: string;

    constructor(chain: Chain, privateKey: string | Buffer) {
        this.chain = chain;
        switch (chain) {
            case Chain.Evm: {
                const wallet = new ethers.Wallet(ethers.hexlify(privateKey));
                this.privateKey = wallet.privateKey;
                break;
            }
            case Chain.Solana: {
                let keyPair;
                if (Buffer.isBuffer(privateKey)) {
                    keyPair = web3.Keypair.fromSecretKey(privateKey);
                }
                else {
                    keyPair = web3.Keypair.fromSecretKey(bs58.decode(privateKey as string));
                }
                this.privateKey = bs58.encode(keyPair.secretKey);
                break;
            }
            default: {
                assertNever(chain);
            }
        }
    }
}
