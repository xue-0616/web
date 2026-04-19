import { Notify, NotifyData, NotifyDataType, isNotifyData } from '../entities/notify.entity';
import { getResponseType } from '../../../common/dto/response';
import { UnknownError } from '../../../error';

class NativeWithdrawNotifyDataDto {
}
class NativeDepositNotifyDataDto {
}
class TokenWithdrawNotifyDataDto {
}
class TokenDepositNotifyDataDto {
}
class LimitOrderFailedNotifyDataDto {
}
class LimitBuySuccessNotifyDataDto {
}
class LimitSellSuccessNotifyDataDto {
}
class SwapFailedNotifyDataDto {
}
class SwapBuySuccessNotifyDataDto {
}
class SwapSellSuccessNotifyDataDto {
}
class AutoStrategyNotifyDataDto {
}
class AutoTradeBuySuccessNotifyDataDto {
}
class AutoTradeBuyFailedNotifyDataDto {
}
class AutoTradeSellSuccessNotifyDataDto {
}
class AutoTradeSellFailedNotifyDataDto {
}
class SwapSellForAutoTradeBaseInSuccessNotifyDataDto {
}
class SwapSellForAutoTradeBaseOutSuccessNotifyDataDto {
}
class SwapSellForAutoTradeBaseOutFailedNotifyDataDto {
}
class SwapSellForAutoTradeBaseInFailedNotifyDataDto {
}
export class NotifyDto {
}
export function toNotifyDto(notify: any) {
    const data = notify.data;
    if (!isNotifyData(data)) {
        throw new UnknownError('Invalid notify data');
    }
    const dataDto = toNotifyDataDto(data);
    return {
        id: notify.id,
        data: dataDto,
        createdAt: notify.createdAt.getTime(),
    };
}
export function toNotifyDataDto(data: any) {
    switch (data.type) {
        case NotifyDataType.NativeWithdraw:
            return {
                type: 'NativeWithdraw',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
            };
        case NotifyDataType.NativeDeposit:
            return {
                type: 'NativeDeposit',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
            };
        case NotifyDataType.TokenWithdraw:
            return {
                type: 'TokenWithdraw',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
            };
        case NotifyDataType.TokenDeposit:
            return {
                type: 'TokenDeposit',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
            };
        case NotifyDataType.LimitOrderFailed:
            return {
                type: 'LimitOrderFailed',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
                tokenMint: data.tokenMint,
                poolId: data.poolId,
            };
        case NotifyDataType.LimitBuySuccess:
            return {
                type: 'LimitBuySuccess',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
                tokenMint: data.tokenMint,
                poolId: data.poolId,
            };
        case NotifyDataType.LimitSellSuccess:
            return {
                type: 'LimitSellSuccess',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
                tokenMint: data.tokenMint,
                poolId: data.poolId,
            };
        case NotifyDataType.SwapBuySuccess:
            return {
                type: 'SwapBuySuccess',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
                tokenMint: data.tokenMint,
                poolId: data.poolId,
            };
        case NotifyDataType.SwapSellSuccess:
            return {
                type: 'SwapSellSuccess',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
                tokenMint: data.tokenMint,
                poolId: data.poolId,
            };
        case NotifyDataType.SwapFailed:
            return {
                type: 'SwapFailed',
                title: data.title,
                body: data.body,
                walletId: data.walletId,
                walletAddress: data.walletAddress,
                tokenMint: data.tokenMint,
                poolId: data.poolId,
            };
        case NotifyDataType.AutoStrategyNotify:
            return {
                type: 'AutoStrategyNotify',
                title: data.title,
                body: data.body,
                strategyId: data.strategyId,
            };
        case NotifyDataType.AutoTradeBuySuccess:
            return {
                type: 'AutoTradeBuySuccess',
                title: data.title,
                body: data.body,
                strategyId: data.strategyId,
            };
        case NotifyDataType.AutoTradeBuyFailed:
            return {
                type: 'AutoTradeBuyFailed',
                title: data.title,
                body: data.body,
                strategyId: data.strategyId,
            };
        case NotifyDataType.AutoTradeSellSuccess:
            return {
                type: 'AutoTradeSellSuccess',
                title: data.title,
                body: data.body,
                strategyId: data.strategyId,
            };
        case NotifyDataType.AutoTradeSellFailed:
            return {
                type: 'AutoTradeSellFailed',
                title: data.title,
                body: data.body,
                strategyId: data.strategyId,
            };
        case NotifyDataType.SwapSellForAutoTradeBaseOutFailed:
            return {
                type: 'SwapSellForAutoTradeBaseOutFailed',
                title: data.title,
                body: data.body,
                eventId: data.eventId,
            };
        case NotifyDataType.SwapSellForAutoTradeBaseInFailed:
            return {
                type: 'SwapSellForAutoTradeBaseInFailed',
                title: data.title,
                body: data.body,
                eventId: data.eventId,
            };
        case NotifyDataType.SwapSellForAutoTradeBaseInSuccess:
            return {
                type: 'SwapSellForAutoTradeBaseInSuccess',
                title: data.title,
                body: data.body,
                eventId: data.eventId,
            };
        case NotifyDataType.SwapSellForAutoTradeBaseOutSuccess:
            return {
                type: 'SwapSellForAutoTradeBaseOutSuccess',
                title: data.title,
                body: data.body,
                eventId: data.eventId,
            };
        case NotifyDataType.SwapSellForAutoTradeBaseOutFailed:
            return {
                type: 'SwapSellForAutoTradeBaseOutFailed',
                title: data.title,
                body: data.body,
                eventId: data.eventId,
            };
    }
}
export class NotifiesDto {
}
export class NotifiesResponse extends getResponseType(NotifiesDto) {
}
export class NotifierRegisterResponse extends getResponseType(undefined) {
}
