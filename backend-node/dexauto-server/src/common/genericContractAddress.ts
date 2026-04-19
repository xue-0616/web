import { web3 } from '@coral-xyz/anchor';
import { GenericAddress } from './genericAddress';
import { TradingClient } from './tradingClient';

export const DEV_SOLANA_TRADING_ACCOUNT = new web3.PublicKey('4EDeLW5uJ2hxmMYUbLasgKJie8RPf8EDwMtiX2Pcz7FX');
export const PROD_SOLANA_TRADING_ACCOUNT = new web3.PublicKey('6L6FCGZ2BcFv2DcddhCCpu48tYyW9RsWev7eyD7D47JZ');
const SEED = 'trading_account';
export class GenericContractAddress {
    address: GenericAddress;
    opKeyAddress: GenericAddress;

    constructor(address: GenericAddress, opKeyAddress: GenericAddress) {
        this.address = address;
        this.opKeyAddress = opKeyAddress;
    }
    static async fromApi(tradingClient: any, ownerAddress: any, index: any) {
        const address = getAddress(ownerAddress, index);
        const opKey = await tradingClient.createOpKey(address);
        return new GenericContractAddress(address, opKey.opKey);
    }
}
function getTradingAccount() {
    switch ((process.env.NODE_ENV || 'DEV').toLowerCase()) {
        case 'prod': {
            return PROD_SOLANA_TRADING_ACCOUNT;
        }
        default: {
            return DEV_SOLANA_TRADING_ACCOUNT;
        }
    }
}
function getAddress(ownerAddress: any, index: any) {
    const nonceBuf = Buffer.alloc(2);
    nonceBuf.writeUInt16LE(index);
    const [address] = web3.PublicKey.findProgramAddressSync([Buffer.from(SEED), ownerAddress.addressBuffer(), nonceBuf], getTradingAccount());
    return GenericAddress.fromSolanaAddr(address);
}
