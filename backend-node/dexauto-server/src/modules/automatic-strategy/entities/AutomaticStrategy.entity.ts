import { Entity, Column, Index } from 'typeorm';

export enum AutomaticStrategyStatus {
    Active = 1,
    Inactive = 2,
    Deleted = 3,
}
export enum AutoTradeStatus {
    Active = 1,
    Inactive = 2,
}

export interface MonitorAddress {
    name: string;
    address: string;
}

export interface AddressSub {
    type: string;
    url: string;
    name: string;
}

export interface TriggerItem {
    type: string;
    upper?: number;
    addrUpper?: number;
    solUpper?: number;
    upperAddressesCount?: number;
    upperSolNormalizedAmount?: string;
    addressesCount?: number;
    [key: string]: any;
}

export interface Trigger {
    items: TriggerItem[];
    index: number;
    startAt?: number;
}

export interface AutoTrade {
    index: number;
    walletId: string;
    walletAddress: string;
    solNormalizedAmount: string;
    isRepeat: boolean;
    tradingOrders?: string[][];
    sell?: { type: AutoTradeSellType; [key: string]: any };
    [key: string]: any;
}
@Index('automatic_strategies_pkey', ['id'], { unique: true })
@Index('automatic_strategy_user_idx', ['status', 'userId'], {})
@Entity('automatic_strategies', { schema: 'public' })
export class AutomaticStrategy {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('character varying', { name: 'name', length: 32 })
  name!: string;

  @Column('jsonb', { name: 'monitor_addresses' })
  monitorAddresses!: MonitorAddress[];

  @Column('jsonb', { name: 'address_subs' })
  addressSubs!: AddressSub[];

  @Column('jsonb', { name: 'triggers' })
  triggers!: Trigger[];

  @Column('jsonb', { name: 'auto_trades' })
  autoTrades!: AutoTrade[];

  @Column('bigint', { name: 'auto_trade_exec_count' })
  autoTradeExecCount!: string;

  @Column({
        type: 'smallint',
        name: 'auto_trade_status',
        enum: AutoTradeStatus,
        enumName: 'AutoTradeStatus',
    })
  autoTradeStatus!: AutoTradeStatus;

  @Column('boolean', { name: 'is_sys_notify_on' })
  isSysNotifyOn!: boolean;

  @Column('bigint', { name: 'notify_exec_count' })
  notifyExecCount!: string;

  @Column({
        type: 'smallint',
        name: 'status',
        enum: AutomaticStrategyStatus,
        enumName: 'AutomaticStrategyStatus',
    })
  status!: AutomaticStrategyStatus;

  @Column('timestamp without time zone', { name: 'start_at' })
  startAt!: Date;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

  @Column('timestamp without time zone', {
        name: 'trigger_start_at',
        nullable: true,
    })
  triggerStartAt!: Date | null;

}
export function isMonitorAddress(monitorAddress: any) {
    return (typeof monitorAddress === 'object' &&
        monitorAddress !== null &&
        'name' in monitorAddress &&
        typeof monitorAddress.name === 'string' &&
        'address' in monitorAddress &&
        typeof monitorAddress.address === 'string');
}
export function isMonitorAddresses(monitorAddresses: any) {
    return (typeof monitorAddresses === 'object' &&
        monitorAddresses !== null &&
        Array.isArray(monitorAddresses) &&
        monitorAddresses.every((monitorAddress) => isMonitorAddress(monitorAddress)));
}
export function isAddressSub(addressSub: any) {
    return (typeof addressSub === 'object' &&
        addressSub !== null &&
        addressSub.type === 'ChainFM' &&
        typeof addressSub.url === 'string' &&
        getChainFMChannelId(addressSub.url) !== null &&
        typeof addressSub.name === 'string');
}
export function getChainFMChannelId(url: any) {
    const match = url.match(/chain\.fm\/channel\/(\d+)/);
    if (!match) {
        return null;
    }
    return match[1];
}
export function isAddressSubs(addressSubs: any) {
    return (typeof addressSubs === 'object' &&
        addressSubs !== null &&
        Array.isArray(addressSubs) &&
        addressSubs.every((addressSub) => isAddressSub(addressSub)));
}
export function isTrigger(trigger: any) {
    return (typeof trigger === 'object' &&
        trigger !== null &&
        Array.isArray(trigger.items) &&
        trigger.items.every((item: any) => isTriggerItem(item)));
}
export function isTriggers(triggers: any) {
    return (typeof triggers === 'object' &&
        triggers !== null &&
        Array.isArray(triggers) &&
        triggers.every((trigger) => isTrigger(trigger)));
}
export enum TriggerItemType {
    PurchaseAddrUpper = "PurchaseAddrUpper",
    PurchaseSolUpper = "PurchaseSolUpper",
    PurchaseAddrAndSolUpper = "PurchaseAddrAndSolUpper",
}
export function isTriggerItem(triggerItem: any) {
    if (typeof triggerItem !== 'object' ||
        triggerItem === null ||
        !('type' in triggerItem) ||
        typeof triggerItem.type !== 'string') {
        return false;
    }
    switch (triggerItem.type) {
        case TriggerItemType.PurchaseAddrUpper:
            return typeof triggerItem.upper === 'number';
        case TriggerItemType.PurchaseSolUpper:
            return typeof triggerItem.upper === 'number';
        case TriggerItemType.PurchaseAddrAndSolUpper:
            return (typeof triggerItem.addrUpper === 'number' &&
                typeof triggerItem.solUpper === 'number');
        default:
            return false;
    }
}
export function isAutoTrade(autoTrade: any) {
    const hasPrimaryWallet =
        typeof autoTrade?.walletId === 'string' &&
        typeof autoTrade?.walletAddress === 'string';
    // Wallet rotation: `subWallets` is an optional array of {walletId, walletAddress}
    // sibling entries. When present, each trade picks one at random to prevent
    // MEV bots from fingerprinting a fixed (following → follower) wallet pair.
    const hasValidSubWallets =
        autoTrade?.subWallets === undefined ||
        (Array.isArray(autoTrade.subWallets) &&
            autoTrade.subWallets.every(
                (sw: any) =>
                    sw &&
                    typeof sw.walletId === 'string' &&
                    typeof sw.walletAddress === 'string',
            ));
    return (typeof autoTrade === 'object' &&
        autoTrade !== null &&
        typeof autoTrade.index === 'number' &&
        hasPrimaryWallet &&
        hasValidSubWallets &&
        typeof autoTrade.solNormalizedAmount === 'string' &&
        typeof autoTrade.isRepeat === 'boolean' &&
        (autoTrade.tradingOrders === undefined ||
            (Array.isArray(autoTrade.tradingOrders) &&
                autoTrade.tradingOrders.every((order: any) => Array.isArray(order)))));
}

/**
 * Pick a wallet for the next trade. If `subWallets` is defined and non-empty,
 * picks one at random (including the primary). Otherwise uses the primary.
 * Returns `{ walletId, walletAddress }` in base58.
 */
export function pickWalletForTrade(autoTrade: any): { walletId: string; walletAddress: string } {
    const primary = { walletId: autoTrade.walletId, walletAddress: autoTrade.walletAddress };
    if (!Array.isArray(autoTrade.subWallets) || autoTrade.subWallets.length === 0) {
        return primary;
    }
    const pool = [primary, ...autoTrade.subWallets];
    return pool[Math.floor(Math.random() * pool.length)];
}
export function isAutoTrades(autoTrades: any) {
    return (typeof autoTrades === 'object' &&
        autoTrades !== null &&
        Array.isArray(autoTrades) &&
        autoTrades.every((autoTrade) => isAutoTrade(autoTrade)));
}
export enum AutoTradeSellType {
    DoubleSell = "DoubleSell",
}
