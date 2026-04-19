import { Chain } from './genericChain';
import { web3 } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { BadRequestException } from '../error';
import bs58 from 'bs58';
import { sign_detached_verify } from 'tweetnacl-ts';
import { assertNever } from './utils';

export class GenericAddress {
    chain: Chain;
    innerAddress: any;
    constructor(chain: Chain, address: string | Buffer) {
        this.chain = chain;
        switch (chain) {
            case Chain.Evm: {
                this.innerAddress = ethers.getAddress(ethers.hexlify(address));
                break;
            }
            case Chain.Solana: {
                this.innerAddress = new web3.PublicKey(address);
                break;
            }
            default: {
                assertNever(chain);
            }
        }
    }
    static fromSolanaAddr(addr: any) {
        return new GenericAddress(Chain.Solana, addr.toBuffer());
    }
    isEqual(other: any): boolean {
        return this.chain === other.chain && this.address === other.address;
    }
    validate(msg: any, sig: any): void {
        switch (this.chain) {
            case Chain.Evm: {
                let addr;
                try {
                    addr = ethers.verifyMessage(msg, sig);
                }
                catch (error) {
                    throw new BadRequestException(`validate msg failed: ${error}`);
                }
                if (addr !== this.innerAddress) {
                    throw new BadRequestException('validate msg failed');
                }
                break;
            }
            case Chain.Solana: {
                let isValid;
                try {
                    isValid = sign_detached_verify(ethers.toUtf8Bytes(msg), bs58.decode(sig), this.addressBuffer());
                }
                catch (error) {
                    throw new BadRequestException(`validate msg failed: ${error}`);
                }
                if (!isValid) {
                    throw new BadRequestException('validate msg failed');
                }
                break;
            }
            default: {
                assertNever(this.chain);
            }
        }
    }
    addressBuffer(): Buffer {
        switch (this.chain) {
            case Chain.Evm: {
                return Buffer.from(ethers.getBytes(this.innerAddress));
            }
            case Chain.Solana: {
                return this.innerAddress.toBuffer();
            }
            default: {
                assertNever(this.chain);
            }
        }
    }
    address(): string {
        switch (this.chain) {
            case Chain.Evm: {
                return this.innerAddress;
            }
            case Chain.Solana: {
                return this.innerAddress.toBase58();
            }
            default: {
                assertNever(this.chain);
            }
        }
    }
}
