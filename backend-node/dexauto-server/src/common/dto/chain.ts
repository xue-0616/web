import { ChainIdDao } from '../../modules/trading/entities/tradingSetting.entity';
import { Chain, ChainId } from '../genericChain';
import { assertNever } from '../utils';

export enum ChainDto {
    Evm = "Evm",
    Solana = "Solana",
}
export function getChainDto(chain: Chain): ChainDto {
    switch (chain) {
        case Chain.Evm: {
            return ChainDto.Evm;
        }
        case Chain.Solana: {
            return ChainDto.Solana;
        }
    }
}
export function getChain(chainDto: ChainDto): Chain {
    switch (chainDto) {
        case ChainDto.Evm: {
            return Chain.Evm;
        }
        case ChainDto.Solana: {
            return Chain.Solana;
        }
        default: {
            assertNever(chainDto);
        }
    }
}
export function getChainIdDao(chainId: any) {
    switch (chainId) {
        case ChainId.Ethereum: {
            return ChainIdDao.Ethereum;
        }
        default: {
            assertNever(chainId);
        }
    }
}
export function getChainId(chainId: any) {
    switch (chainId) {
        case ChainIdDao.Ethereum: {
            return ChainId.Ethereum;
        }
        default: {
            assertNever(chainId);
        }
    }
}
