import { TradingOrder, TradingOrderStatus, TradingOrderType } from '../entities/tradingOrder.entity';
import { getResponseType } from '../../../common/dto/response';
import bs58 from 'bs58';
import { web3 } from '@coral-xyz/anchor';
import { assertNever } from '../../../common/utils';

export enum TradingOrderStatusDto {
    Created = "Created",
    ChainTxPending = "ChainTxPending",
    Success = "Success",
    Failed = "Failed",
    Cancelled = "Cancelled",
    WaitingStart = "WaitingStart",
}
export enum OrderTypeDto {
    SwapBuy = "Buy",
    SwapSell = "Sell",
    LimitBuy = "LimitBuy",
    LimitSell = "LimitSell",
    NativeDeposit = "NativeDeposit",
    NativeWithdraw = "NativeWithdraw",
    TokenDeposit = "TokenDeposit",
    TokenWithdraw = "TokenWithdraw",
    AutoTradeBuy = "AutoTradeBuy",
    AutoTradeSell = "AutoTradeSell",
    SwapSellForAutoTradeBaseIn = "SwapSellForAutoTradeBaseIn",
    SwapSellForAutoTradeBaseOut = "SwapSellForAutoTradeBaseOut",
}
export function getTradingOrderType(orderTypeDto: OrderTypeDto): TradingOrderType {
    switch (orderTypeDto) {
        case OrderTypeDto.SwapBuy: {
            return TradingOrderType.SwapBuy;
        }
        case OrderTypeDto.SwapSell: {
            return TradingOrderType.SwapSell;
        }
        case OrderTypeDto.LimitBuy: {
            return TradingOrderType.LimitBuy;
        }
        case OrderTypeDto.LimitSell: {
            return TradingOrderType.LimitSell;
        }
        case OrderTypeDto.NativeDeposit: {
            return TradingOrderType.NativeDeposit;
        }
        case OrderTypeDto.NativeWithdraw: {
            return TradingOrderType.NativeWithdraw;
        }
        case OrderTypeDto.TokenDeposit: {
            return TradingOrderType.TokenDeposit;
        }
        case OrderTypeDto.TokenWithdraw: {
            return TradingOrderType.TokenWithdraw;
        }
        case OrderTypeDto.AutoTradeBuy: {
            return TradingOrderType.AutoTradeBuy;
        }
        case OrderTypeDto.AutoTradeSell: {
            return TradingOrderType.AutoTradeSell;
        }
        case OrderTypeDto.SwapSellForAutoTradeBaseIn: {
            return TradingOrderType.SwapSellForAutoTradeBaseIn;
        }
        case OrderTypeDto.SwapSellForAutoTradeBaseOut: {
            return TradingOrderType.SwapSellForAutoTradeBaseOut;
        }
        default: {
            throw new Error(`Unknown order type DTO: ${orderTypeDto}`);
        }
    }
}
export function getOrderTypeDto(orderTypeDao: TradingOrderType): OrderTypeDto {
    switch (orderTypeDao) {
        case TradingOrderType.SwapBuy: {
            return OrderTypeDto.SwapBuy;
        }
        case TradingOrderType.SwapSell: {
            return OrderTypeDto.SwapSell;
        }
        case TradingOrderType.LimitBuy: {
            return OrderTypeDto.LimitBuy;
        }
        case TradingOrderType.LimitSell: {
            return OrderTypeDto.LimitSell;
        }
        case TradingOrderType.NativeDeposit: {
            return OrderTypeDto.NativeDeposit;
        }
        case TradingOrderType.NativeWithdraw: {
            return OrderTypeDto.NativeWithdraw;
        }
        case TradingOrderType.TokenDeposit: {
            return OrderTypeDto.TokenDeposit;
        }
        case TradingOrderType.TokenWithdraw: {
            return OrderTypeDto.TokenWithdraw;
        }
        case TradingOrderType.AutoTradeBuy: {
            return OrderTypeDto.AutoTradeBuy;
        }
        case TradingOrderType.AutoTradeSell: {
            return OrderTypeDto.AutoTradeSell;
        }
        case TradingOrderType.SwapSellForAutoTradeBaseIn: {
            return OrderTypeDto.SwapSellForAutoTradeBaseIn;
        }
        case TradingOrderType.SwapSellForAutoTradeBaseOut: {
            return OrderTypeDto.SwapSellForAutoTradeBaseOut;
        }
        default: {
            throw new Error(`Unknown trading order type: ${orderTypeDao}`);
        }
    }
}
export enum TradingOrderErrorCode {
    SlippageExceeded = "SlippageExceeded",
    TxExpired = "TxExpired",
    InsufficientFunds = "InsufficientFunds",
    Unknown = "Unknown",
}
export class TradingOrderDto {
}
export class TradingOrderResponse extends getResponseType(TradingOrderDto) {
}
export function getTradingOrderStatus(status: TradingOrderStatusDto): TradingOrderStatus {
    switch (status) {
        case TradingOrderStatusDto.Created: {
            return TradingOrderStatus.Created;
        }
        case TradingOrderStatusDto.ChainTxPending: {
            return TradingOrderStatus.ChainTxPending;
        }
        case TradingOrderStatusDto.Success: {
            return TradingOrderStatus.Success;
        }
        case TradingOrderStatusDto.Failed: {
            return TradingOrderStatus.Failed;
        }
        case TradingOrderStatusDto.Cancelled: {
            return TradingOrderStatus.Cancelled;
        }
        case TradingOrderStatusDto.WaitingStart: {
            return TradingOrderStatus.WaitingStart;
        }
        default: {
            throw new Error(`Unknown trading order status DTO: ${status}`);
        }
    }
}
export function getTradingOrderStatusDto(status: TradingOrderStatus): TradingOrderStatusDto {
    switch (status) {
        case TradingOrderStatus.Created: {
            return TradingOrderStatusDto.Created;
        }
        case TradingOrderStatus.ChainTxPending: {
            return TradingOrderStatusDto.ChainTxPending;
        }
        case TradingOrderStatus.Success: {
            return TradingOrderStatusDto.Success;
        }
        case TradingOrderStatus.Failed: {
            return TradingOrderStatusDto.Failed;
        }
        case TradingOrderStatus.Cancelled: {
            return TradingOrderStatusDto.Cancelled;
        }
        case TradingOrderStatus.WaitingStart: {
            return TradingOrderStatusDto.WaitingStart;
        }
        default: {
            throw new Error(`Unknown trading order status: ${status}`);
        }
    }
}
export function getOrderDto(order: any) {
    let confirmedTime;
    switch (order.status) {
        case TradingOrderStatus.WaitingStart:
        case TradingOrderStatus.Created:
        case TradingOrderStatus.Cancelled:
        case TradingOrderStatus.ChainTxPending: {
            confirmedTime = null;
            break;
        }
        case TradingOrderStatus.Success:
        case TradingOrderStatus.Failed: {
            confirmedTime =
                order.confirmedTime?.getTime() ?? order.updatedAt.getTime();
            break;
        }
        default: {
            assertNever(order.status);
        }
    }
    const errorReason = order.errorReason;
    let errorCode = null;
    if (errorReason !== null) {
        if (errorReason.includes('Slippage exceeded limit')) {
            errorCode = TradingOrderErrorCode.SlippageExceeded;
        }
        else if (errorReason.includes('tx expired')) {
            errorCode = TradingOrderErrorCode.TxExpired;
        }
        else if (errorReason.includes('Solana balance insufficient')) {
            errorCode = TradingOrderErrorCode.InsufficientFunds;
        }
        else {
            errorCode = TradingOrderErrorCode.Unknown;
        }
    }
    return {
        id: order.id,
        txId: order.txId ? bs58.encode(order.txId) : null,
        tokenSymbol: order.tokenSymbol,
        solNormalizedAmount: order.solNormalizedAmount,
        tokenNormalizedAmount: order.tokenNormalizedAmount,
        usdAmount: order.usdAmount,
        orderType: getOrderTypeDto(order.orderType),
        pool: order.pool ? new web3.PublicKey(order.pool).toBase58() : null,
        status: getTradingOrderStatusDto(order.status),
        triggerPriceUsd: order.triggerPriceUsd,
        errorCode,
        errorReason,
        createdAt: order.createdAt.getTime(),
        confirmedTime,
    };
}
export class TradingOrdersDto {
}
export class TradingOrdersResponse extends getResponseType(TradingOrdersDto) {
}
