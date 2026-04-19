import Decimal from 'decimal.js';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { NATIVE_TOKEN_ADDRESS, chainErc20Config } from './erc20.token';
import { getAddress } from 'ethers/lib/utils';

interface TokenConfig { symbol: string; decimals: number; cid: number }

// `chainErc20Config` is a deeply-typed literal; accessing by dynamic chainId
// / address legitimately needs a loose index. Keep the import for runtime and
// narrow through this alias at access points.
const erc20Config = chainErc20Config as unknown as Record<number, Record<string, TokenConfig>>;

export const getTokenRate = (
    tokenPrice: Decimal.Value,
    nativePrice: Decimal.Value,
): Decimal => {
    const rate = new Decimal(tokenPrice).div(nativePrice);
    return new Decimal(rate);
};

export const getTokenUsd = (
    usdPrice: Record<number, Decimal.Value>,
    tokenConfig: TokenConfig,
): Decimal => {
    const tokenUsd = usdPrice[tokenConfig.cid];
    const tokenUsdDecimal = new Decimal(tokenUsd);
    return tokenUsdDecimal;
};

export const getConsumedGasInfo = (
    consumedGasUsed: BigNumberish,
    consumedGasPrice: BigNumberish,
    tokenConfig: TokenConfig,
) => {
    const gasFee = utils.formatUnits(
        BigNumber.from(`${consumedGasUsed}`).mul(BigNumber.from(`${consumedGasPrice}`)),
        tokenConfig.decimals,
    );
    const consumedFee = new Decimal(gasFee);
    return { consumedGasUsed, consumedGasPrice, consumedFee };
};

export const getUserPaidGas = (
    nativePrice: Decimal.Value,
    userPaidTokenAmount: BigNumberish | null | undefined,
    userPaidTokenDecimal: number = 18,
    userPaidUsdPrice: Decimal.Value | null | undefined,
) => {
    if (!userPaidTokenAmount || !userPaidUsdPrice) {
        return { userPaidFee: 0, userPaidGas: 0 };
    }
    const userPaidFee = new Decimal(utils.formatUnits(userPaidTokenAmount, userPaidTokenDecimal));
    const userPaidTokenRate = getTokenRate(userPaidFee.toNumber(), nativePrice);
    const userPaidGas = userPaidFee
        .mul(userPaidTokenRate.mul(userPaidUsdPrice))
        .toNumber();
    return { userPaidFee: Number.parseFloat(userPaidFee.toFixed()), userPaidGas };
};

export const getTankPaidGas = (
    consumedFee: Decimal,
    tokenPrice: Record<number, Decimal.Value>,
    tokenConfig: TokenConfig,
    nativeTokenUsdPrice: Decimal.Value,
    userPaidGas: number = 0,
) => {
    const tankPaidTokenUsdPrice = getTokenUsd(tokenPrice, tokenConfig);
    const tankPaidGas = consumedFee.sub(new Decimal(userPaidGas));
    const tankPaidTokenRate = getTokenRate(tankPaidTokenUsdPrice.toNumber(), nativeTokenUsdPrice);
    const tankPaidFee = tankPaidGas.div(tankPaidTokenRate.mul(tankPaidTokenUsdPrice));
    return {
        tankPaidGas,
        tankPaidTokenRate,
        tankPaidFee,
        tankPaidTokenUsdPrice,
    };
};

export const getTokenConfig = (
    input: { chainId: number },
    tankPaidToken: string,
    tankTokenChainId: number,
) => {
    const { chainId } = input;
    const nativeTokenConfig = erc20Config[chainId][NATIVE_TOKEN_ADDRESS];
    const tankTokenConfig = erc20Config[tankTokenChainId][getAddress(tankPaidToken)];
    return { nativeTokenConfig, tankTokenConfig };
};
