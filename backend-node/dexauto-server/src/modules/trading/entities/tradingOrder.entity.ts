import Decimal from 'decimal.js';
import { web3 } from '@coral-xyz/anchor';
import { Column, Entity, Index } from 'typeorm';
import { v7 } from 'uuid';
import bs58 from 'bs58';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WSOL } from '../../../common/utils';

const NATIVE_SOL_SYMBOL = 'Sol';
export enum TradingOrderStatus {
    Created = 0,
    ChainTxPending = 1,
    Success = 2,
    Failed = 3,
    Cancelled = 4,
    WaitingStart = 5,
}
export enum TradingOrderType {
    SwapBuy = 0,
    SwapSell = 1,
    LimitBuy = 2,
    LimitSell = 3,
    NativeDeposit = 4,
    NativeWithdraw = 5,
    TokenDeposit = 6,
    TokenWithdraw = 7,
    AutoTradeBuy = 8,
    AutoTradeSell = 9,
    SwapSellForAutoTradeBaseIn = 10,
    SwapSellForAutoTradeBaseOut = 11,
}
@Entity('trading_orders', { schema: 'public' })
@Index('pool_idx', ['pool', 'status'])
@Index('order_user_status_idx', ['userId', 'status'])
@Index('order_user_type_idx', ['userId', 'orderType'])
export class TradingOrder {
    @Column('uuid', { primary: true, name: 'id' })
    id!: string;

    @Column('uuid', { name: 'user_id' })
    userId!: string;

    @Column('uuid', { name: 'wallet_id', nullable: true })
    walletId!: string;

    @Column('bytea', { name: 'wallet_address' })
    walletAddress!: Buffer;

    @Column('smallint', { name: 'order_type' })
    orderType!: TradingOrderType;

    @Column('bytea', { name: 'pool', nullable: true })
    pool!: Buffer | null;

    @Column('numeric', { name: 'slippage', nullable: true })
    slippage!: string | null;

    @Column('bigint', { name: 'priority_fee', nullable: true })
    priorityFee!: string | null;

    @Column('bigint', { name: 'bribery_amount', nullable: true })
    briberyAmount!: string | null;

    @Column('bigint', { name: 'threshold_amount', nullable: true })
    thresholdAmount!: string | null;

    @Column('numeric', { name: 'threshold_normalized_amount', nullable: true })
    thresholdNormalizedAmount!: string | null;

    @Column('boolean', { name: 'is_anti_mev', nullable: true })
    isAntiMev!: boolean | null;

    @Index('tx_uk', { unique: true })
    @Column('bytea', { name: 'tx_id', nullable: true })
    txId!: Buffer | null;

    @Column('bytea', { name: 'token_mint', nullable: true })
    tokenMint!: Buffer | null;

    @Column('character varying', { name: 'token_symbol', length: 32 })
    tokenSymbol!: string;

    @Column('bigint', { name: 'token_amount', nullable: true })
    tokenAmount!: string | null;

    @Column('numeric', { name: 'token_normalized_amount', nullable: true })
    tokenNormalizedAmount!: string | null;

    @Column('numeric', { name: 'token_usd_price', nullable: true })
    tokenUsdPrice!: string | null;

    @Column('bytea', { name: 'sol_mint', nullable: true })
    solMint!: Buffer | null;

    @Column('bigint', { name: 'sol_amount', nullable: true })
    solAmount!: string | null;

    @Column('numeric', { name: 'sol_normalized_amount', nullable: true })
    solNormalizedAmount!: string | null;

    @Column('numeric', { name: 'sol_usd_price', nullable: true })
    solUsdPrice!: string | null;

    @Column('numeric', { name: 'usd_amount', nullable: true })
    usdAmount!: string | null;

    @Column('numeric', { name: 'trigger_price_usd', nullable: true })
    triggerPriceUsd!: string | null;

    @Column('smallint', { name: 'status' })
    status!: TradingOrderStatus;

    @Column('character varying', { name: 'error_reason', length: 1024, nullable: true })
    errorReason!: string | null;

    @Column('uuid', { name: 'remote_id', nullable: true })
    remoteId!: string | null;

    @Column('timestamp without time zone', { name: 'created_at' })
    createdAt!: Date;

    @Column('timestamp without time zone', { name: 'updated_at' })
    updatedAt!: Date;

    @Column('timestamp without time zone', { name: 'confirmed_time', nullable: true })
    confirmedTime!: Date | null;
    static createSwapSellOrder({ userId, walletId, walletAddress, pool, slippage, priorityFee, briberyAmount, outAmount, outNormalizedAmount, isAntiMev, tokenMint, tokenSymbol, tokenDecimals, amount, solMint }: { userId: any; walletId: any; walletAddress: any; pool: any; slippage: any; priorityFee: any; briberyAmount: any; outAmount: any; outNormalizedAmount: any; isAntiMev: any; tokenMint: any; tokenSymbol: any; tokenDecimals: any; amount: any; solMint: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.SwapSell;
        tradingOrder.pool = pool.toBuffer();
        tradingOrder.slippage = slippage.toString();
        tradingOrder.priorityFee = priorityFee.toString();
        tradingOrder.briberyAmount = briberyAmount.toString();
        tradingOrder.thresholdAmount = outAmount.toString();
        tradingOrder.thresholdNormalizedAmount = outNormalizedAmount;
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.txId = null;
        tradingOrder.tokenMint = tokenMint.toBuffer();
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenAmount = amount.toString();
        tradingOrder.tokenNormalizedAmount = new Decimal(amount.toString())
            .div(new Decimal(10).pow(tokenDecimals))
            .toString();
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solMint = solMint.toBuffer();
        tradingOrder.solAmount = null;
        tradingOrder.solNormalizedAmount = null;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = null;
        tradingOrder.triggerPriceUsd = null;
        tradingOrder.status = TradingOrderStatus.Created;
        tradingOrder.errorReason = null;
        tradingOrder.remoteId = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = null;
        return tradingOrder;
    }
    static createLimitBuyOrder({ userId, walletId, walletAddress, pool, slippage, priorityFee, briberyAmount, isAntiMev, tokenMint, tokenSymbol, amount, solNormalizedAmount, solMint, triggerPriceUsd }: { userId: any; walletId: any; walletAddress: any; pool: any; slippage: any; priorityFee: any; briberyAmount: any; isAntiMev: any; tokenMint: any; tokenSymbol: any; amount: any; solNormalizedAmount: any; solMint: any; triggerPriceUsd: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.LimitBuy;
        tradingOrder.pool = pool.toBuffer();
        tradingOrder.slippage = slippage.toString();
        tradingOrder.priorityFee = priorityFee.toString();
        tradingOrder.briberyAmount = briberyAmount.toString();
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.txId = null;
        tradingOrder.tokenMint = tokenMint.toBuffer();
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenAmount = null;
        tradingOrder.tokenNormalizedAmount = null;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solMint = solMint.toBuffer();
        tradingOrder.solAmount = amount.toString();
        tradingOrder.solNormalizedAmount = solNormalizedAmount.toString();
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = null;
        tradingOrder.triggerPriceUsd = triggerPriceUsd.toFixed();
        tradingOrder.status = TradingOrderStatus.Created;
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = null;
        tradingOrder.remoteId = null;
        return tradingOrder;
    }
    static createSwapSellForAutoTradeBaseInOrder({ userId, walletId, walletAddress, pool, slippage, priorityFee, briberyAmount, outAmount, outNormalizedAmount, isAntiMev, tokenMint, tokenSymbol, tokenDecimals, amount, solMint, autoTradeEventId }: { userId: any; walletId: any; walletAddress: any; pool: any; slippage: any; priorityFee: any; briberyAmount: any; outAmount: any; outNormalizedAmount: any; isAntiMev: any; tokenMint: any; tokenSymbol: any; tokenDecimals: any; amount: any; solMint: any; autoTradeEventId: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.SwapSellForAutoTradeBaseIn;
        tradingOrder.pool = pool.toBuffer();
        tradingOrder.slippage = slippage.toString();
        tradingOrder.priorityFee = priorityFee.toString();
        tradingOrder.briberyAmount = briberyAmount.toString();
        tradingOrder.thresholdAmount = outAmount.toString();
        tradingOrder.thresholdNormalizedAmount = outNormalizedAmount;
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.txId = null;
        tradingOrder.tokenMint = tokenMint.toBuffer();
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenAmount = amount.toString();
        tradingOrder.tokenNormalizedAmount = new Decimal(amount.toString())
            .div(new Decimal(10).pow(tokenDecimals))
            .toString();
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solMint = solMint.toBuffer();
        tradingOrder.solAmount = null;
        tradingOrder.solNormalizedAmount = null;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = null;
        tradingOrder.remoteId = autoTradeEventId;
        tradingOrder.status = TradingOrderStatus.Created;
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = null;
        return tradingOrder;
    }
    static createSwapSellForAutoTradeBaseOutOrder({ userId, walletId, walletAddress, pool, slippage, priorityFee, briberyAmount, outAmount, outNormalizedAmount, isAntiMev, tokenMint, tokenSymbol, tokenDecimals, amount, solMint, autoTradeEventId }: { userId: any; walletId: any; walletAddress: any; pool: any; slippage: any; priorityFee: any; briberyAmount: any; outAmount: any; outNormalizedAmount: any; isAntiMev: any; tokenMint: any; tokenSymbol: any; tokenDecimals: any; amount: any; solMint: any; autoTradeEventId: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.SwapSellForAutoTradeBaseOut;
        tradingOrder.pool = pool.toBuffer();
        tradingOrder.slippage = slippage.toString();
        tradingOrder.priorityFee = priorityFee.toString();
        tradingOrder.briberyAmount = briberyAmount.toString();
        tradingOrder.thresholdAmount = amount.toString();
        tradingOrder.thresholdNormalizedAmount = new Decimal(amount.toString())
            .div(new Decimal(10).pow(tokenDecimals))
            .toString();
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.txId = null;
        tradingOrder.tokenMint = tokenMint.toBuffer();
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.tokenAmount = null;
        tradingOrder.tokenNormalizedAmount = null;
        tradingOrder.solMint = solMint.toBuffer();
        tradingOrder.solAmount = outAmount.toString();
        tradingOrder.solNormalizedAmount = outNormalizedAmount;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = null;
        tradingOrder.remoteId = autoTradeEventId;
        tradingOrder.triggerPriceUsd = null;
        tradingOrder.status = TradingOrderStatus.Created;
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = null;
        return tradingOrder;
    }
    static createLimitSellOrder({ userId, walletId, walletAddress, pool, slippage, priorityFee, briberyAmount, isAntiMev, tokenMint, tokenSymbol, tokenDecimals, amount, solMint, triggerPriceUsd }: { userId: any; walletId: any; walletAddress: any; pool: any; slippage: any; priorityFee: any; briberyAmount: any; isAntiMev: any; tokenMint: any; tokenSymbol: any; tokenDecimals: any; amount: any; solMint: any; triggerPriceUsd: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.LimitSell;
        tradingOrder.pool = pool.toBuffer();
        tradingOrder.slippage = slippage.toString();
        tradingOrder.priorityFee = priorityFee.toString();
        tradingOrder.briberyAmount = briberyAmount.toString();
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.txId = null;
        tradingOrder.tokenMint = tokenMint.toBuffer();
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenAmount = amount.toString();
        tradingOrder.tokenNormalizedAmount = new Decimal(amount.toString())
            .div(new Decimal(10).pow(tokenDecimals))
            .toString();
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solMint = solMint.toBuffer();
        tradingOrder.solAmount = null;
        tradingOrder.solNormalizedAmount = null;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = null;
        tradingOrder.triggerPriceUsd = triggerPriceUsd.toFixed();
        tradingOrder.status = TradingOrderStatus.Created;
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = null;
        tradingOrder.remoteId = null;
        return tradingOrder;
    }
    static createSwapBuyOrder({ userId, walletId, walletAddress, pool, slippage, priorityFee, briberyAmount, isAntiMev, tokenMint, tokenSymbol, amount, solNormalizedAmount, solMint }: { userId: any; walletId: any; walletAddress: any; pool: any; slippage: any; priorityFee: any; briberyAmount: any; isAntiMev: any; tokenMint: any; tokenSymbol: any; amount: any; solNormalizedAmount: any; solMint: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.SwapBuy;
        tradingOrder.pool = pool.toBuffer();
        tradingOrder.slippage = slippage.toString();
        tradingOrder.priorityFee = priorityFee.toString();
        tradingOrder.briberyAmount = briberyAmount.toString();
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.txId = null;
        tradingOrder.tokenMint = tokenMint.toBuffer();
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenAmount = null;
        tradingOrder.tokenNormalizedAmount = null;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solMint = solMint.toBuffer();
        tradingOrder.solAmount = amount.toString();
        tradingOrder.solNormalizedAmount = solNormalizedAmount;
        tradingOrder.solUsdPrice = null;
        tradingOrder.triggerPriceUsd = null;
        tradingOrder.usdAmount = null;
        tradingOrder.status = TradingOrderStatus.Created;
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = null;
        tradingOrder.remoteId = null;
        return tradingOrder;
    }
    static createNativeWithdrawOrder({ userId, walletId, walletAddress, txId, confirmedTime, tokenAmount, tokenNormalizedAmount, usdAmount }: { userId: any; walletId: any; walletAddress: any; txId: any; confirmedTime: any; tokenAmount: any; tokenNormalizedAmount: any; usdAmount: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.NativeWithdraw;
        tradingOrder.pool = null;
        tradingOrder.slippage = null;
        tradingOrder.priorityFee = null;
        tradingOrder.briberyAmount = null;
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.isAntiMev = null;
        tradingOrder.txId = Buffer.from(bs58.decode(txId));
        tradingOrder.tokenMint = null;
        tradingOrder.tokenSymbol = NATIVE_SOL_SYMBOL;
        tradingOrder.tokenNormalizedAmount = tokenNormalizedAmount;
        tradingOrder.tokenAmount = tokenAmount;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.triggerPriceUsd = null;
        tradingOrder.solMint = null;
        tradingOrder.solAmount = null;
        tradingOrder.solNormalizedAmount = null;
        tradingOrder.solUsdPrice = null;
        tradingOrder.status = TradingOrderStatus.Success;
        tradingOrder.usdAmount = usdAmount.toFixed();
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = confirmedTime;
        return tradingOrder;
    }
    static createNativeDepositOrder({ userId, walletId, walletAddress, txId, confirmedTime, tokenNormalizedAmount, tokenAmount, usdAmount }: { userId: any; walletId: any; walletAddress: any; txId: any; confirmedTime: any; tokenNormalizedAmount: any; tokenAmount: any; usdAmount: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.txId = Buffer.from(bs58.decode(txId));
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.NativeDeposit;
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.triggerPriceUsd = null;
        tradingOrder.pool = null;
        tradingOrder.slippage = null;
        tradingOrder.priorityFee = null;
        tradingOrder.briberyAmount = null;
        tradingOrder.isAntiMev = null;
        tradingOrder.solMint = null;
        tradingOrder.tokenMint = null;
        tradingOrder.status = TradingOrderStatus.Success;
        tradingOrder.tokenSymbol = NATIVE_SOL_SYMBOL;
        tradingOrder.tokenNormalizedAmount = tokenNormalizedAmount;
        tradingOrder.tokenAmount = tokenAmount;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solAmount = null;
        tradingOrder.solNormalizedAmount = null;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = usdAmount.toFixed();
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = confirmedTime;
        return tradingOrder;
    }
    static createTokenWithdrawOrder({ userId, walletId, walletAddress, txId, confirmedTime, tokenMint, tokenSymbol, tokenNormalizedAmount, tokenAmount, usdAmount }: { userId: any; walletId: any; walletAddress: any; txId: any; confirmedTime: any; tokenMint: any; tokenSymbol: any; tokenNormalizedAmount: any; tokenAmount: any; usdAmount: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.txId = Buffer.from(bs58.decode(txId));
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.TokenWithdraw;
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.triggerPriceUsd = null;
        tradingOrder.pool = null;
        tradingOrder.slippage = null;
        tradingOrder.priorityFee = null;
        tradingOrder.briberyAmount = null;
        tradingOrder.isAntiMev = null;
        tradingOrder.solMint = null;
        tradingOrder.tokenMint = Buffer.from(bs58.decode(tokenMint));
        tradingOrder.status = TradingOrderStatus.Success;
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenNormalizedAmount = tokenNormalizedAmount;
        tradingOrder.tokenAmount = tokenAmount;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solAmount = null;
        tradingOrder.solNormalizedAmount = null;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = usdAmount.toFixed();
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = confirmedTime;
        return tradingOrder;
    }
    static createTokenDepositOrder({ userId, walletId, walletAddress, txId, confirmedTime, tokenMint, tokenSymbol, tokenNormalizedAmount, tokenAmount, usdAmount }: { userId: any; walletId: any; walletAddress: any; txId: any; confirmedTime: any; tokenMint: any; tokenSymbol: any; tokenNormalizedAmount: any; tokenAmount: any; usdAmount: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.txId = Buffer.from(bs58.decode(txId));
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.TokenDeposit;
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.triggerPriceUsd = null;
        tradingOrder.pool = null;
        tradingOrder.slippage = null;
        tradingOrder.priorityFee = null;
        tradingOrder.briberyAmount = null;
        tradingOrder.isAntiMev = null;
        tradingOrder.solMint = null;
        tradingOrder.tokenMint = Buffer.from(bs58.decode(tokenMint));
        tradingOrder.status = TradingOrderStatus.Success;
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenNormalizedAmount = tokenNormalizedAmount;
        tradingOrder.tokenAmount = tokenAmount;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solAmount = null;
        tradingOrder.solNormalizedAmount = null;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = usdAmount.toFixed();
        tradingOrder.errorReason = null;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.confirmedTime = confirmedTime;
        return tradingOrder;
    }
    static createAutoTradeOrder({ userId, tokenMint, tokenSymbol, pool, solUsdPrice, eventId, slippage, priorityFee, briberyAmount, isAntiMev, walletId, walletAddress, solNormalizedAmount }: { userId: any; tokenMint: any; tokenSymbol: any; pool: any; solUsdPrice: any; eventId: any; slippage: any; priorityFee: any; briberyAmount: any; isAntiMev: any; walletId: any; walletAddress: any; solNormalizedAmount: any }) {
        const now = new Date();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.AutoTradeBuy;
        tradingOrder.pool = Buffer.from(bs58.decode(pool));
        tradingOrder.slippage = slippage;
        tradingOrder.priorityFee = priorityFee;
        tradingOrder.briberyAmount = briberyAmount;
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.thresholdAmount = '0';
        tradingOrder.thresholdNormalizedAmount = '0';
        tradingOrder.tokenMint = Buffer.from(bs58.decode(tokenMint));
        tradingOrder.tokenAmount = null;
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenNormalizedAmount = null;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solMint = Buffer.from(bs58.decode(WSOL));
        tradingOrder.solAmount = new Decimal(solNormalizedAmount)
            .mul(LAMPORTS_PER_SOL)
            .toFixed(0);
        tradingOrder.solNormalizedAmount = solNormalizedAmount;
        tradingOrder.solUsdPrice = solUsdPrice.toString();
        tradingOrder.usdAmount = solUsdPrice.mul(solNormalizedAmount).toFixed();
        tradingOrder.status = TradingOrderStatus.Created;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.remoteId = eventId;
        return tradingOrder;
    }
    static createAutoTradeSellOrder({ userId, tokenMint, tokenSymbol, pool, walletId, walletAddress, outAmount, eventId, slippage, priorityFee, briberyAmount, isAntiMev }: { userId: any; tokenMint: any; tokenSymbol: any; pool: any; walletId: any; walletAddress: any; outAmount: any; eventId: any; slippage: any; priorityFee: any; briberyAmount: any; isAntiMev: any }) {
        const now = new Date();
        const outNormalizedAmount = new Decimal(outAmount.toString())
            .div(web3.LAMPORTS_PER_SOL)
            .toFixed();
        const tradingOrder = new TradingOrder();
        tradingOrder.id = v7();
        tradingOrder.userId = userId;
        tradingOrder.walletId = walletId;
        tradingOrder.walletAddress = walletAddress;
        tradingOrder.orderType = TradingOrderType.AutoTradeSell;
        tradingOrder.pool = Buffer.from(bs58.decode(pool));
        tradingOrder.slippage = slippage;
        tradingOrder.priorityFee = priorityFee;
        tradingOrder.briberyAmount = briberyAmount;
        tradingOrder.isAntiMev = isAntiMev;
        tradingOrder.thresholdAmount = null;
        tradingOrder.thresholdNormalizedAmount = null;
        tradingOrder.tokenMint = Buffer.from(bs58.decode(tokenMint));
        tradingOrder.tokenAmount = null;
        tradingOrder.tokenSymbol = tokenSymbol;
        tradingOrder.tokenNormalizedAmount = null;
        tradingOrder.tokenUsdPrice = null;
        tradingOrder.solMint = Buffer.from(bs58.decode(WSOL));
        tradingOrder.solAmount = outAmount.toString();
        tradingOrder.solNormalizedAmount = outNormalizedAmount;
        tradingOrder.solUsdPrice = null;
        tradingOrder.usdAmount = null;
        tradingOrder.status = TradingOrderStatus.WaitingStart;
        tradingOrder.createdAt = now;
        tradingOrder.updatedAt = now;
        tradingOrder.remoteId = eventId;
        return tradingOrder;
    }
}
