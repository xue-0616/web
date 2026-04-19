import { Entity, Column, Index } from 'typeorm';

export enum NotifyType {
    NativeWithdraw = 0,
    NativeDeposit = 1,
    TokenWithdraw = 2,
    TokenDeposit = 3,
    LimitBuySuccess = 4,
    LimitSellSuccess = 5,
    LimitOrderFailed = 6,
    SwapBuySuccess = 7,
    SwapSellSuccess = 8,
    SwapFailed = 9,
    AutoStrategyNotify = 10,
    AutoTradeBuySuccess = 11,
    AutoTradeBuyFailed = 12,
    AutoTradeSellSuccess = 13,
    AutoTradeSellFailed = 14,
    SwapSellForAutoTradeBaseInSuccess = 15,
    SwapSellForAutoTradeBaseOutSuccess = 16,
    SwapSellForAutoTradeBaseInFailed = 17,
    SwapSellForAutoTradeBaseOutFailed = 18,
}

export interface NotifyData {
    type: NotifyDataType;
    title: string;
    body: string;
    walletId: string;
    walletAddress: string;
    tokenMint?: string;
    poolId?: string;
    [key: string]: any;
}
@Index('notifies_pkey', ['id'], { unique: true })
@Index('notifies_user_id_idx', ['notifyType', 'userId'], {})
@Entity('notifies', { schema: 'public' })
export class Notify {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column({
        type: 'smallint',
        name: 'notify_type',
        enum: NotifyType,
        enumName: 'NotifyType',
    })
  notifyType!: NotifyType;

  @Column('json', { name: 'data' })
  data!: NotifyData;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

}
export enum NotifyDataType {
    NativeDeposit = "NativeDeposit",
    NativeWithdraw = "NativeWithdraw",
    TokenDeposit = "TokenDeposit",
    TokenWithdraw = "TokenWithdraw",
    LimitBuySuccess = "LimitBuySuccess",
    LimitSellSuccess = "LimitSellSuccess",
    LimitOrderFailed = "LimitOrderFailed",
    SwapBuySuccess = "SwapBuySuccess",
    SwapSellSuccess = "SwapSellSuccess",
    SwapFailed = "SwapFailed",
    AutoStrategyNotify = "AutoStrategyNotify",
    AutoTradeBuySuccess = "AutoTradeBuySuccess",
    AutoTradeBuyFailed = "AutoTradeBuyFailed",
    AutoTradeSellSuccess = "AutoTradeSellSuccess",
    AutoTradeSellFailed = "AutoTradeSellFailed",
    SwapSellForAutoTradeBaseInSuccess = "SwapSellForAutoTradeBaseInSuccess",
    SwapSellForAutoTradeBaseOutSuccess = "SwapSellForAutoTradeBaseOutSuccess",
    SwapSellForAutoTradeBaseInFailed = "SwapSellForAutoTradeBaseInFailed",
    SwapSellForAutoTradeBaseOutFailed = "SwapSellForAutoTradeBaseOutFailed",
}
export function toNotifyType(type: any) {
    switch (type) {
        case NotifyDataType.NativeDeposit:
            return NotifyType.NativeDeposit;
        case NotifyDataType.NativeWithdraw:
            return NotifyType.NativeWithdraw;
        case NotifyDataType.TokenDeposit:
            return NotifyType.TokenDeposit;
        case NotifyDataType.TokenWithdraw:
            return NotifyType.TokenWithdraw;
        case NotifyDataType.LimitOrderFailed:
            return NotifyType.LimitOrderFailed;
        case NotifyDataType.LimitBuySuccess:
            return NotifyType.LimitBuySuccess;
        case NotifyDataType.LimitSellSuccess:
            return NotifyType.LimitSellSuccess;
        case NotifyDataType.SwapBuySuccess:
            return NotifyType.SwapBuySuccess;
        case NotifyDataType.SwapSellSuccess:
            return NotifyType.SwapSellSuccess;
        case NotifyDataType.SwapFailed:
            return NotifyType.SwapFailed;
        case NotifyDataType.AutoStrategyNotify:
            return NotifyType.AutoStrategyNotify;
        case NotifyDataType.AutoTradeBuySuccess:
            return NotifyType.AutoTradeBuySuccess;
        case NotifyDataType.AutoTradeBuyFailed:
            return NotifyType.AutoTradeBuyFailed;
        case NotifyDataType.AutoTradeSellSuccess:
            return NotifyType.AutoTradeSellSuccess;
        case NotifyDataType.AutoTradeSellFailed:
            return NotifyType.AutoTradeSellFailed;
        case NotifyDataType.SwapSellForAutoTradeBaseInSuccess:
            return NotifyType.SwapSellForAutoTradeBaseInSuccess;
        case NotifyDataType.SwapSellForAutoTradeBaseOutSuccess:
            return NotifyType.SwapSellForAutoTradeBaseOutSuccess;
        case NotifyDataType.SwapSellForAutoTradeBaseInFailed:
            return NotifyType.SwapSellForAutoTradeBaseInFailed;
        case NotifyDataType.SwapSellForAutoTradeBaseOutFailed:
            return NotifyType.SwapSellForAutoTradeBaseOutFailed;
    }
}
export function isNotifyData(data: any) {
    if (typeof data !== 'object' ||
        data === null ||
        !('type' in data) ||
        typeof data.type !== 'string') {
        return false;
    }
    const isValidType = Object.values(NotifyDataType).includes(data.type);
    if (!isValidType) {
        return false;
    }
    const hasRequiredFields = typeof data.title === 'string' &&
        typeof data.body === 'string' &&
        typeof data.walletId === 'string' &&
        typeof data.walletAddress === 'string';
    if (!hasRequiredFields) {
        return false;
    }
    const needsTokenFields = [
        NotifyDataType.LimitBuySuccess,
        NotifyDataType.LimitSellSuccess,
        NotifyDataType.LimitOrderFailed,
        NotifyDataType.SwapBuySuccess,
        NotifyDataType.SwapSellSuccess,
        NotifyDataType.SwapFailed,
        NotifyDataType.AutoStrategyNotify,
        NotifyDataType.AutoTradeBuySuccess,
        NotifyDataType.AutoTradeBuyFailed,
    ].includes(data.type);
    if (needsTokenFields) {
        return (typeof data.tokenMint === 'string' && typeof data.poolId === 'string');
    }
    return true;
}
