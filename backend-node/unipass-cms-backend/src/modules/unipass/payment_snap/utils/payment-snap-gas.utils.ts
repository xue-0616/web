import { format } from 'date-fns';
import Decimal from 'decimal.js';
import { formatUnits } from 'ethers';
import { NATIVE_TOKEN_ADDRESS, getChainName, getTokenAmount, getUsdAmount, nativeToken, sortList } from '../../chain/utils';

type ChainUsdMap = Record<string, number>;
type ChainConsumeMap = Record<string, { usd: number; symbol: string; amount: number }>;

export const getChainUsdMap = (dayMap: Map<any, ChainUsdMap>, date: any, chainId: string, feeUsd: number) => {
    const normalizedFeeUsd = getUsdAmount(feeUsd);
    const chainName = getChainName(chainId);
    if (!chainName) {
        return dayMap;
    }
    const dayUsd = dayMap.get(date) || {};
    dayUsd[chainName] = dayUsd[chainName]
        ? new Decimal(dayUsd[chainName]).add(new Decimal(normalizedFeeUsd)).toNumber()
        : normalizedFeeUsd;
    dayMap.set(date, dayUsd);
    return dayMap;
};

export const getReceiveList = (dayMap: Map<any, ChainUsdMap>, app: string) => {
    const list: any[] = [];
    for (const [date, chainUsd] of dayMap) {
        const data: any = {
            date,
            day: format(new Date(date), 'yyyy/MM/dd'),
            app,
            bsc: chainUsd.bsc || 0,
            polygon: chainUsd.polygon || 0,
            arb: chainUsd.arb || 0,
        };
        data.all = new Decimal(data.bsc).add(new Decimal(data.polygon)).add(new Decimal(data.arb)).toNumber();
        list.push(data);
    }
    return list;
};

export const getPaymentSnapReceiveList = (snap: any[], payment: any[], start: any, end: any) => {
    const from = format(new Date(start), 'yyyy/MM/dd');
    const to = format(new Date(end), 'yyyy/MM/dd HH:mm:ss');
    const list = sortList(snap.concat(payment));
    let polygon = 0;
    let bsc = 0;
    let arb = 0;
    for (const item of list) {
        polygon = new Decimal(polygon).add(new Decimal(item.polygon || 0)).toNumber();
        bsc = new Decimal(bsc).add(new Decimal(item.bsc || 0)).toNumber();
        arb = new Decimal(arb).add(new Decimal(item.arb || 0)).toNumber();
    }
    list.push({
        app: 'Total',
        polygon,
        bsc,
        arb,
        all: new Decimal(polygon).add(new Decimal(bsc)).add(new Decimal(arb)).toNumber(),
        day: `${from}-${to}`,
        date: `${from}-${to}`,
    });
    return list;
};

export const getGasFee = (chainId: string, gasLimit: string, gasPrice: string, logger: { error: (message: string) => void }) => {
    let gasFee = '0';
    try {
        const decimals = nativeToken[chainId]?.[NATIVE_TOKEN_ADDRESS]?.decimals ?? 'ether';
        gasFee = formatUnits(BigInt(gasLimit) * BigInt(gasPrice), decimals as any);
    } catch (error: any) {
        logger.error(`[getRelayerTransaction] getGasFee error:${(error as Error)?.message},gasLimit = ${gasLimit} gasPrice =${gasPrice}`);
    }
    return gasFee;
};

export const getPaymentSnapConsumeList = (snap: any[], payment: any[], start: any, end: any) => {
    const from = format(new Date(start), 'yyyy/MM/dd');
    const to = format(new Date(end), 'yyyy/MM/dd HH:mm:ss');
    const list = sortList(snap.concat(payment));
    let polygonUsd = 0;
    let bscUsd = 0;
    let arbUsd = 0;
    let polygonAmount = 0;
    let bscAmount = 0;
    let arbAmount = 0;
    for (const item of list) {
        polygonUsd = new Decimal(polygonUsd).add(new Decimal(item.polygonUsd || 0)).toNumber();
        bscUsd = new Decimal(bscUsd).add(new Decimal(item.bscUsd || 0)).toNumber();
        arbUsd = new Decimal(arbUsd).add(new Decimal(item.arbUsd || 0)).toNumber();
        polygonAmount = new Decimal(polygonAmount).add(new Decimal(item.polygonAmount || 0)).toNumber();
        bscAmount = new Decimal(bscAmount).add(new Decimal(item.bscAmount || 0)).toNumber();
        arbAmount = new Decimal(arbAmount).add(new Decimal(item.arbAmount || 0)).toNumber();
    }
    list.push({
        app: 'Total',
        polygonUsd,
        bscUsd,
        arbUsd,
        polygonAmount,
        bscAmount,
        arbAmount,
        all: new Decimal(polygonUsd).add(new Decimal(bscUsd)).add(new Decimal(arbUsd)).toNumber(),
        day: `${from}-${to}`,
        date: `${from}-${to}`,
    });
    return list;
};

export const getChainConsumeUsdMap = (dayMap: Map<any, ChainConsumeMap>, date: any, chainId: string, feeUsd: number, amount: number, symbol: string) => {
    const normalizedFeeUsd = getUsdAmount(feeUsd);
    const normalizedAmount = getTokenAmount(amount);
    const chainName = getChainName(chainId);
    if (!chainName) {
        return dayMap;
    }
    const dayUsd = dayMap.get(date) || {};
    const chainUsd = dayUsd[chainName];
    dayUsd[chainName] = chainUsd
        ? {
            usd: new Decimal(chainUsd.usd).add(new Decimal(normalizedFeeUsd)).toNumber(),
            amount: new Decimal(chainUsd.amount).add(new Decimal(normalizedAmount)).toNumber(),
            symbol,
        }
        : {
            usd: normalizedFeeUsd,
            amount: normalizedAmount,
            symbol,
        };
    dayMap.set(date, dayUsd);
    return dayMap;
};

export const getConsumeList = (dayMap: Map<any, ChainConsumeMap>, app: string) => {
    const list: any[] = [];
    for (const [date, chainUsdAmount] of dayMap) {
        const bsc = chainUsdAmount.bsc || { usd: 0, amount: 0 };
        const polygon = chainUsdAmount.polygon || { usd: 0, amount: 0 };
        const arb = chainUsdAmount.arb || { usd: 0, amount: 0 };
        const data: any = {
            date,
            day: format(new Date(date), 'yyyy/MM/dd'),
            app,
            bscUsd: bsc.usd,
            polygonUsd: polygon.usd,
            arbUsd: arb.usd,
            bscAmount: bsc.amount,
            polygonAmount: polygon.amount,
            arbAmount: arb.amount,
        };
        data.all = new Decimal(data.bscUsd).add(new Decimal(data.polygonUsd)).add(new Decimal(data.arbUsd)).toNumber();
        list.push(data);
    }
    return list;
};

export const getCustomDiscount = (userPaidGas: number | string, consumedFee: number | string) => {
    if (!userPaidGas || Number(userPaidGas) === 0) {
        return 0;
    }
    return getUsdAmount(new Decimal(userPaidGas).div(new Decimal(consumedFee)).mul(100).toNumber());
};

export const getCustomDiscountMap = (customTxFeeList: any[]) => {
    const discountMap = new Map<string, any>();
    customTxFeeList.forEach((item) => {
        discountMap.set(`0x${item.chainTxHash}`, item);
    });
    return discountMap;
};
