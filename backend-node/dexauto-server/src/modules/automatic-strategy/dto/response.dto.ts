import { AddressSub, AutomaticStrategy, AutomaticStrategyStatus, AutoTrade, AutoTradeSellType, AutoTradeStatus, MonitorAddress, Trigger, TriggerItem, TriggerItemType, getChainFMChannelId } from '../entities/AutomaticStrategy.entity';
import Decimal from 'decimal.js';
import { PinoLogger } from 'nestjs-pino';
import { TradingOrderDto } from '../../trading/dto/order.response.dto';
import { AutomaticStrategyEvent, AutomaticStrategyEventData } from '../entities/AutomaticStrategyEvent.entity';
import { TradingOrder } from '../../trading/entities/tradingOrder.entity';
import { getOrderDto } from '../../trading/dto/order.response.dto';
import { getResponseType } from '../../../common/dto/response';
import { BadRequestException, UnknownError } from '../../../error';
import { web3 } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { assertNever } from '../../../common/utils';

const SOL_DECIMALS = 9;
export class MonitorAddressDto {
}
export function toMonitorAddress(monitorAddress: any, logger: PinoLogger) {
    let address = monitorAddress.address;
    try {
        const web3Address = new web3.PublicKey(address);
        address = web3Address.toBase58();
    }
    catch (error) {
        logger.error(`Address is invalid: ${error}`);
        throw new BadRequestException(`Address is invalid: ${error}`);
    }
    return {
        name: monitorAddress.name,
        address,
    };
}
export function toMonitorAddressDto(monitorAddress: any) {
    return {
        name: monitorAddress.name,
        address: monitorAddress.address,
    };
}
export enum AddressSubType {
    ChainFM = "ChainFM",
}
export class AddressSubDto {
}
export function toAddressSub(addressSub: any, index: number, name: string) {
    switch (addressSub.type) {
        case AddressSubType.ChainFM: {
            if (getChainFMChannelId(addressSub.url) === null) {
                throw new BadRequestException('Invalid ChainFM channel URL');
            }
            return {
                type: 'ChainFM',
                url: addressSub.url,
                index,
                name,
            };
        }
        default: {
            assertNever(addressSub.type);
        }
    }
}
export function toAddressSubDto(addressSub: any) {
    switch (addressSub.type) {
        case 'ChainFM':
            return {
                type: AddressSubType.ChainFM,
                url: addressSub.url,
                index: addressSub.index,
            };
        default: {
            assertNever(addressSub.type);
        }
    }
}
export enum AutoTradeSellDto {
    None = "None",
    DoubleSell = "DoubleSell",
}
export function toAutoTradeSellDto(autoTradeSell: any) {
    if (!autoTradeSell) {
        return AutoTradeSellDto.None;
    }
    switch (autoTradeSell.type) {
        case AutoTradeSellType.DoubleSell: {
            return AutoTradeSellDto.DoubleSell;
        }
        default: {
            assertNever(autoTradeSell.type);
        }
    }
}
export function toAutoTradeSell(autoTradeSellDto: any) {
    if (!autoTradeSellDto) {
        return null;
    }
    switch (autoTradeSellDto) {
        case AutoTradeSellDto.None: {
            return null;
        }
        case AutoTradeSellDto.DoubleSell: {
            return {
                type: AutoTradeSellType.DoubleSell,
            };
        }
    }
}
export class AutoTradeDto {
}
export function toAutoTrade(autoTrade: any, logger: PinoLogger, walletIndex: number, walletAddress: string, index: number) {
    let solNormalizedAmount = autoTrade.solNormalizedAmount;
    let solNormalizedAmountDecimal;
    try {
        solNormalizedAmountDecimal = new Decimal(solNormalizedAmount);
    }
    catch (error) {
        logger.error(`Sol normalized amount is invalid: ${error}`);
        throw new BadRequestException(`Sol normalized amount is invalid: ${error}`);
    }
    if (solNormalizedAmountDecimal.lt(0)) {
        logger.error('Sol normalized amount must be greater than 0');
        throw new BadRequestException('Sol normalized amount must be greater than 0');
    }
    solNormalizedAmount = solNormalizedAmountDecimal.toFixed(SOL_DECIMALS);
    return {
        index,
        walletId: autoTrade.walletId,
        solNormalizedAmount,
        isRepeat: autoTrade.isRepeat,
        walletAddress,
        walletIndex,
        sell: toAutoTradeSell(autoTrade.sell) || undefined,
    };
}
export function toAutoTradeDto(autoTrade: any) {
    return {
        index: autoTrade.index,
        walletId: autoTrade.walletId,
        solNormalizedAmount: new Decimal(autoTrade.solNormalizedAmount).toFixed(),
        isRepeat: autoTrade.isRepeat,
        walletIndex: autoTrade.walletIndex,
        sell: toAutoTradeSellDto(autoTrade.sell),
    };
}
export class PurchaseAddrUpperTriggerItemDto {
}
export class PurchaseSolUpperTriggerItemDto {
}
export class PurchaseAddrAndSolUpperTriggerItemDto {
}
export function toTriggerItem(triggerItem: any, logger: PinoLogger) {
    switch (triggerItem.type) {
        case TriggerItemType.PurchaseAddrUpper: {
            const upperAddressesCount = triggerItem.upperAddressesCount;
            if (upperAddressesCount < 1) {
                logger.error('Upper addresses count must be greater than 0');
                throw new BadRequestException('Upper addresses count must be greater than 0');
            }
            if (!Number.isInteger(upperAddressesCount)) {
                logger.error('Upper addresses count must be an integer');
                throw new BadRequestException('Upper addresses count must be an integer');
            }
            return {
                type: TriggerItemType.PurchaseAddrUpper,
                upperAddressesCount,
            };
        }
        case TriggerItemType.PurchaseSolUpper: {
            let upperSolNormalizedAmount = triggerItem.upperSolNormalizedAmount;
            let upperSolNormalizedAmountDecimal;
            try {
                upperSolNormalizedAmountDecimal = new Decimal(upperSolNormalizedAmount);
            }
            catch (error) {
                logger.error(`Upper sol normalized amount is invalid: ${error}`);
                throw new BadRequestException(`Upper sol normalized amount is invalid: ${error}`);
            }
            if (upperSolNormalizedAmountDecimal.lt(0)) {
                logger.error('Upper sol normalized amount must be greater than 0');
                throw new BadRequestException('Upper sol normalized amount must be greater than 0');
            }
            upperSolNormalizedAmount =
                upperSolNormalizedAmountDecimal.toFixed(SOL_DECIMALS);
            return {
                type: TriggerItemType.PurchaseSolUpper,
                upperSolNormalizedAmount,
            };
        }
        case TriggerItemType.PurchaseAddrAndSolUpper: {
            const addressesCount = triggerItem.addressesCount;
            if (addressesCount < 1) {
                throw new BadRequestException('Addresses count must be greater than 0');
            }
            if (!Number.isInteger(addressesCount)) {
                throw new BadRequestException('Addresses count must be an integer');
            }
            let upperSolNormalizedAmount = triggerItem.upperSolNormalizedAmount;
            let upperSolNormalizedAmountDecimal;
            try {
                upperSolNormalizedAmountDecimal = new Decimal(upperSolNormalizedAmount);
            }
            catch (error) {
                logger.error(`Upper sol normalized amount is invalid: ${error}`);
                throw new BadRequestException(`Upper sol normalized amount is invalid: ${error}`);
            }
            if (upperSolNormalizedAmountDecimal.lt(0)) {
                logger.error('Upper sol normalized amount must be greater than 0');
                throw new BadRequestException('Upper sol normalized amount must be greater than 0');
            }
            upperSolNormalizedAmount =
                upperSolNormalizedAmountDecimal.toFixed(SOL_DECIMALS);
            return {
                type: TriggerItemType.PurchaseAddrAndSolUpper,
                addressesCount,
                upperSolNormalizedAmount,
            };
        }
    }
}
export function toTriggerItemDto(triggerItem: any) {
    switch (triggerItem.type) {
        case TriggerItemType.PurchaseAddrUpper:
            return {
                type: TriggerItemType.PurchaseAddrUpper,
                upperAddressesCount: triggerItem.upperAddressesCount,
            };
        case TriggerItemType.PurchaseSolUpper:
            return {
                type: TriggerItemType.PurchaseSolUpper,
                upperSolNormalizedAmount: new Decimal(triggerItem.upperSolNormalizedAmount).toFixed(),
            };
        case TriggerItemType.PurchaseAddrAndSolUpper:
            return {
                type: TriggerItemType.PurchaseAddrAndSolUpper,
                addressesCount: triggerItem.addressesCount,
                upperSolNormalizedAmount: new Decimal(triggerItem.upperSolNormalizedAmount).toFixed(),
            };
    }
}
export class TriggerDto {
}
export function toTrigger(trigger: any, logger: PinoLogger, index: number) {
    return {
        index,
        items: trigger.items.map((item: any) => toTriggerItem(item, logger)),
    };
}
export function toTriggerDto(trigger: any) {
    return {
        index: trigger.index,
        items: trigger.items.map(toTriggerItemDto),
    };
}
export enum AutomaticStrategyStatusDto {
    Active = "Active",
    Inactive = "Inactive",
    Deleted = "Deleted",
}
export function toAutomaticStrategyStatus(status: AutomaticStrategyStatusDto) {
    switch (status) {
        case AutomaticStrategyStatusDto.Active:
            return AutomaticStrategyStatus.Active;
        case AutomaticStrategyStatusDto.Inactive:
            return AutomaticStrategyStatus.Inactive;
        case AutomaticStrategyStatusDto.Deleted:
            return AutomaticStrategyStatus.Deleted;
    }
}
export function toAutomaticStrategyStatusDto(status: AutomaticStrategyStatus) {
    switch (status) {
        case AutomaticStrategyStatus.Active:
            return AutomaticStrategyStatusDto.Active;
        case AutomaticStrategyStatus.Inactive:
            return AutomaticStrategyStatusDto.Inactive;
        case AutomaticStrategyStatus.Deleted:
            return AutomaticStrategyStatusDto.Deleted;
    }
}
export enum AutoTradeStatusDto {
    Active = "Active",
    Inactive = "Inactive",
    NotSetting = "NotSetting",
}
export function toAutoTradeStatusDto(status: AutoTradeStatus, autoTrades: any[]) {
    if (autoTrades.length === 0) {
        return AutoTradeStatusDto.NotSetting;
    }
    switch (status) {
        case AutoTradeStatus.Active:
            return AutoTradeStatusDto.Active;
        case AutoTradeStatus.Inactive:
            return AutoTradeStatusDto.Inactive;
    }
}
export function toAutoTradeStatus(status: AutoTradeStatusDto, autoTrades: any[]): [any, any] {
    switch (status) {
        case AutoTradeStatusDto.Active:
            return [
                AutoTradeStatus.Active,
                autoTrades.map((autoTrade) => ({
                    ...autoTrade,
                    tradingOrderId: undefined,
                })),
            ];
        case AutoTradeStatusDto.Inactive:
            return [AutoTradeStatus.Inactive, autoTrades];
        case AutoTradeStatusDto.NotSetting:
            return [AutoTradeStatus.Active, []];
    }
}
export class AutomaticStrategyDto {
}
export function toAutomaticStrategyDto(automaticStrategy: any, autoTradeExecCount24h: number, notifyExecCount24h: number) {
    return {
        id: automaticStrategy.id,
        name: automaticStrategy.name,
        monitorAddresses: automaticStrategy.monitorAddresses.map(toMonitorAddressDto),
        addressSubs: automaticStrategy.addressSubs.map(toAddressSubDto),
        triggers: automaticStrategy.triggers.map(toTriggerDto),
        autoTrades: automaticStrategy.autoTrades.map(toAutoTradeDto),
        autoTradeStatus: toAutoTradeStatusDto(automaticStrategy.autoTradeStatus, automaticStrategy.autoTrades),
        autoTradeExecCount: automaticStrategy.autoTradeExecCount,
        autoTradeExecCount24h,
        isSysNotifyOn: automaticStrategy.isSysNotifyOn,
        notifyExecCount: automaticStrategy.notifyExecCount,
        notifyExecCount24h,
        status: toAutomaticStrategyStatusDto(automaticStrategy.status),
        createdTime: automaticStrategy.createdAt.getTime(),
        startTime: automaticStrategy.startAt.getTime(),
    };
}
export class AutomaticStrategyResponse extends getResponseType(AutomaticStrategyDto) {
}
export class AutomaticStrategiesDto {
}
export class AutomaticStrategiesResponse extends getResponseType(AutomaticStrategiesDto) {
}
export class AutomaticStrategyEventTxDto {
}
export function toAutomaticStrategyEventTxDto(tx: any) {
    return {
        txId: tx.txId,
        address: toMonitorAddressDto(tx.address),
        tokenMint: tx.tokenMint,
        tokenSymbol: tx.tokenSymbol,
        tokenIcon: tx.tokenIcon,
        tokenNormalizedAmount: tx.tokenNormalizedAmount,
        tokenUsdPrice: tx.tokenUsdPrice,
        usdAmount: tx.usdAmount,
        solNormalizedAmount: tx.solNormalizedAmount,
        txConfirmedTime: tx.txConfirmedTime,
    };
}
export class AutomaticStrategyEventItemDto {
}
export function toAutomaticStrategyEventItemDto(item: any) {
    return {
        item: toTriggerItemDto(item.item),
        txs: item.txs.map(toAutomaticStrategyEventTxDto),
    };
}
export class AutomaticStrategyTriggerEventDto {
}
export function toAutomaticStrategyTriggerEventDto(triggerEvent: any) {
    return {
        items: triggerEvent.items.map(toAutomaticStrategyEventItemDto),
    };
}
export class AutomaticStrategyEventDto {
}
export function toAutomaticStrategyEventDto(event: any, tx: any, tokenUsdPrice: any) {
    return {
        id: event.id,
        createdTime: event.createdAt.getTime(),
        tokenSymbol: event.tokenSymbol,
        tokenIcon: event.tokenIcon,
        tokenMint: bs58.encode(event.tokenMint),
        triggerIndex: event.triggerIndex,
        triggerEvents: event.triggerEvent,
        triggerTokenUsdPrice: event.tokenUsdPrice,
        tokenUsdPrice: tokenUsdPrice.toFixed(),
        tokenUsdPriceChangePercent: tokenUsdPrice.eq(0)
            ? null
            : tokenUsdPrice
                .sub(event.tokenUsdPrice)
                .div(event.tokenUsdPrice)
                .mul(100)
                .toFixed(),
        isAutoTradeActive: event.autoTradeIds !== null && event.autoTradeIds.length > 0,
        autoTrade: tx ? getOrderDto(tx) : undefined,
    };
}
export class AutomaticStrategyEventsDto {
}
export class AutomaticStrategyEventsResponse extends getResponseType(AutomaticStrategyEventsDto) {
}
export class ChainFMChannelInfoDto {
    name!: string;
    addresses!: { name: string; address: string }[];
}
export class ChainFMChannelInfoResponse extends getResponseType(ChainFMChannelInfoDto) {
}
export enum AutoTradeSellTypeDto {
    None = "None",
    DoubleSell = "DoubleSell",
}
export function toAutoTradeSellTypeDto(autoTradeSellType: any) {
    if (!autoTradeSellType) {
        return AutoTradeSellTypeDto.None;
    }
    switch (autoTradeSellType) {
        case AutoTradeSellType.DoubleSell:
            return AutoTradeSellTypeDto.DoubleSell;
        default:
            assertNever(autoTradeSellType);
    }
}
export class AutomaticStrategyUnsoldEventDto {
}
export function toAutomaticStrategyUnsoldEventDto(event: any, autoTradeBuy: any, autoTradeSell: any, tokenUsdPrice: any, solUsdPrice: any, logger: PinoLogger) {
    if (autoTradeBuy.solNormalizedAmount === null) {
        logger.error('Auto trade buy is not completed');
        throw new UnknownError('Auto trade buy is not completed');
    }
    if (event.autoTradeReservedNormalizedAmount === null) {
        logger.error('Auto trade reserved normalized amount is not set');
        throw new UnknownError('Auto trade reserved normalized amount is not set');
    }
    if (event.autoTradeReservedAmount === null) {
        logger.error('Auto trade reserved amount is not set');
        throw new UnknownError('Auto trade reserved amount is not set');
    }
    const autoTradeEvent = (event.autoTrades || []).find((event: any) => event.buyId === autoTradeBuy.id);
    if (autoTradeEvent === undefined) {
        logger.error('Auto trade event is not found');
        throw new UnknownError('Auto trade event is not found');
    }
    if (autoTradeBuy.tokenUsdPrice === null) {
        logger.error('Auto trade buy token usd price is not set');
        throw new UnknownError('Auto trade buy token usd price is not set');
    }
    return {
        id: event.id,
        createdTime: event.createdAt.getTime(),
        tokenSymbol: event.tokenSymbol,
        tokenIcon: event.tokenIcon,
        tokenMint: bs58.encode(event.tokenMint),
        triggerTokenUsdPrice: event.tokenUsdPrice,
        boughtTokenUsdPrice: autoTradeBuy.tokenUsdPrice,
        tokenUsdPrice: tokenUsdPrice.toFixed(),
        tokenUsdPriceChangePercent: tokenUsdPrice.eq(0)
            ? null
            : tokenUsdPrice
                .sub(autoTradeBuy.tokenUsdPrice)
                .div(autoTradeBuy.tokenUsdPrice)
                .mul(100)
                .toFixed(),
        solNormalizedAmount: autoTradeBuy.solNormalizedAmount,
        reservedTokenAmount: event.autoTradeReservedAmount,
        reservedTokenNormalizedAmount: event.autoTradeReservedNormalizedAmount,
        reservedTokenSolNormalizedAmount: tokenUsdPrice
            .mul(event.autoTradeReservedNormalizedAmount)
            .div(solUsdPrice)
            .toFixed(),
        autoTradeSellType: toAutoTradeSellTypeDto(autoTradeEvent.sellType),
        autoTradeSellOrder: autoTradeSell ? getOrderDto(autoTradeSell) : undefined,
    };
}
export class AutomaticStrategyUnsoldEventsDto {
}
export class AutomaticStrategyUnsoldEventsResponse extends getResponseType(AutomaticStrategyUnsoldEventsDto) {
}
