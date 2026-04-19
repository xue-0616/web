import { ChainDto, getChainDto } from '../../../common/dto/chain';
import { Chain } from '../../../common/genericChain';
import { ChainId } from '../../../common/genericChain';
import { Wallet } from '../entities/wallet.entity';
import { getResponseType } from '../../../common/dto/response';
import { GenericAddress } from '../../../common/genericAddress';
import { GenericContractAddress } from '../../../common/genericContractAddress';

export class WalletInfoDto {
    id!: string;
    index!: number;
    alias!: string | null;
    isDefault!: boolean;
    chain: any;
    chainIds: any;
    address!: string;
    opKeyAddress!: string;
}
const SUPPORTED_EVM_CHAIN_IDS: any[] = [];
export function getWalletInfo(wallet: any) {
    let chainIds = null;
    if (wallet.chain === Chain.Evm) {
        chainIds = SUPPORTED_EVM_CHAIN_IDS;
    }
    const contract = new GenericContractAddress(new GenericAddress(wallet.chain, wallet.address), new GenericAddress(wallet.chain, wallet.opKey));
    return {
        id: wallet.id,
        index: wallet.index,
        alias: wallet.alias === null ? null : wallet.alias,
        isDefault: wallet.isDefault,
        chain: getChainDto(wallet.chain),
        chainIds,
        address: contract.address.address(),
        opKeyAddress: contract.opKeyAddress.address(),
    };
}
export class WalletInfoResponse extends getResponseType(WalletInfoDto) {
}
export class ExportedPrivateKey {
}
export class DeleteWalletResponse extends getResponseType(undefined) {
}
export class ExportPrivateKeyResponse extends getResponseType(ExportedPrivateKey) {
}
export class TokenBalanceInfoDto {
}
export class WalletOverviewDto {
}
export class WalletOverviewResponse extends getResponseType(WalletOverviewDto) {
}
