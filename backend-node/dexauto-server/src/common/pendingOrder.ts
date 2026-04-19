import { DataSource, Repository } from 'typeorm';
import { ClickHouseService } from '../infrastructure/clickhouse/clickhouse.service';
import { AutomaticStrategyEvent, AutomaticTradeStatus } from '../modules/automatic-strategy/entities/AutomaticStrategyEvent.entity';
import { MessageNotifierService } from '../modules/message-notifier/message-notifier.service';
import { TradingOrder, TradingOrderStatus, TradingOrderType } from '../modules/trading/entities/tradingOrder.entity';
import { TradingSetting } from '../modules/trading/entities/tradingSetting.entity';
import { WalletOrderStatistic } from '../modules/wallet/entities/walletOrderStatistic.entity';
import { TradingClient, SwapTransactionStatus, SwapType, getTradingOrderStatus } from './tradingClient';
import { DexTrade } from '../infrastructure/clickhouse/clickhouse.service';
import { web3 } from '@coral-xyz/anchor';
import { Logger } from '@nestjs/common';
import bs58 from 'bs58';
import Decimal from 'decimal.js';
import { v7 } from 'uuid';
import { BadRequestException, UnknownError } from '../error';
import { DOUBLE_SELL_PRICE_MULTIPLIER } from '../modules/automatic-strategy-syncer/utils/automatic-strategy-executor';
import { Wallet } from '../modules/wallet/entities/wallet.entity';
import { assertNever, isNullOrUndefined } from './utils';
import { PositionMonitorService, TrackedPosition } from '../modules/position-monitor/position-monitor.service';

export const USD_PRECISION = 8;

/**
 * Maximum total retry attempts for a pending order before giving up.
 * Prevents infinite resource consumption for permanently failing orders.
 */
const MAX_RETRY_ATTEMPTS = 50;

export class PendingOrder {
    order: TradingOrder;
    tradingClient: TradingClient;
    tradingOrderRepository: Repository<TradingOrder>;
    dataSource: DataSource;
    clickHouseService: ClickHouseService;
    walletOrderStatisticRepository: Repository<WalletOrderStatistic>;
    automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>;
    messageNotifyService: MessageNotifierService;
    tradingSettingRepository: Repository<TradingSetting>;
    nextOrder?: TradingOrder;
    positionMonitorService?: PositionMonitorService;
    logger: any;
    constructor(order: TradingOrder, tradingClient: TradingClient, tradingOrderRepository: Repository<TradingOrder>, dataSource: DataSource, clickHouseService: ClickHouseService, walletOrderStatisticRepository: Repository<WalletOrderStatistic>, automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>, messageNotifyService: MessageNotifierService, tradingSettingRepository: Repository<TradingSetting>, nextOrder?: TradingOrder | undefined, positionMonitorService?: PositionMonitorService) {
        this.order = order;
        this.tradingClient = tradingClient;
        this.tradingOrderRepository = tradingOrderRepository;
        this.dataSource = dataSource;
        this.clickHouseService = clickHouseService;
        this.walletOrderStatisticRepository = walletOrderStatisticRepository;
        this.automaticStrategyEventRepository = automaticStrategyEventRepository;
        this.messageNotifyService = messageNotifyService;
        this.tradingSettingRepository = tradingSettingRepository;
        this.nextOrder = nextOrder;
        this.positionMonitorService = positionMonitorService;
        this.logger = new Logger(PendingOrder.name);
    }
    async wait(): Promise<void> {
        if (this.order.status === TradingOrderStatus.Created ||
            this.order.status === TradingOrderStatus.ChainTxPending) {
            let errTimes = 0;
            let totalAttempts = 0;
            while (totalAttempts < MAX_RETRY_ATTEMPTS) {
                totalAttempts++;
                try {
                    if (this.order.slippage === null) {
                        throw new Error('expected slippage');
                    }
                    const slippage = new Decimal(this.order.slippage);
                    let amountSpecified;
                    let otherAmountThreshold;
                    let inputMint;
                    let outputMint;
                    let triggerPriceUsd;
                    let swapType;
                    let baseIn;
                    switch (this.order.orderType) {
                        case TradingOrderType.SwapBuy:
                        case TradingOrderType.LimitBuy:
                        case TradingOrderType.AutoTradeBuy: {
                            if (this.order.solAmount === null ||
                                this.order.solNormalizedAmount === null) {
                                throw new Error(`sol amount should not be null for ${this.order.id}`);
                            }
                            if (this.order.solMint === null) {
                                throw new Error(`sol mint should not be null for ${this.order.id}`);
                            }
                            if (this.order.tokenMint === null) {
                                throw new Error(`token mint should not be null for ${this.order.id}`);
                            }
                            baseIn = true;
                            amountSpecified = BigInt(this.order.solAmount);
                            inputMint = new web3.PublicKey(this.order.solMint).toBase58();
                            outputMint = new web3.PublicKey(this.order.tokenMint).toBase58();
                            if (this.order.orderType === TradingOrderType.SwapBuy ||
                                this.order.orderType === TradingOrderType.AutoTradeBuy) {
                                if (this.order.thresholdAmount === null) {
                                    throw new Error(`expected out amount for order ${this.order.id}`);
                                }
                                otherAmountThreshold = BigInt(new Decimal(this.order.thresholdAmount)
                                    .mul(new Decimal(1).sub(slippage))
                                    .toFixed(0));
                                triggerPriceUsd = null;
                                swapType = SwapType.QuickSwap;
                            }
                            else {
                                otherAmountThreshold = null;
                                if (this.order.triggerPriceUsd === null) {
                                    throw new Error(`expected trigger price usd for ${this.order.id}`);
                                }
                                triggerPriceUsd = new Decimal(this.order.triggerPriceUsd);
                                swapType = SwapType.GreaterPriceSwap;
                            }
                            break;
                        }
                        case TradingOrderType.AutoTradeSell: {
                            if (this.order.solAmount === null ||
                                this.order.solNormalizedAmount === null) {
                                throw new Error(`sol amount should not be null for ${this.order.id}`);
                            }
                            if (this.order.tokenMint === null) {
                                throw new Error(`token mint should not be null for ${this.order.id}`);
                            }
                            if (this.order.solMint === null) {
                                throw new Error(`sol mint should not be null for ${this.order.id}`);
                            }
                            if (this.order.thresholdAmount === null) {
                                throw new Error(`expected out amount for order ${this.order.id}`);
                            }
                            baseIn = false;
                            inputMint = new web3.PublicKey(this.order.tokenMint).toBase58();
                            outputMint = new web3.PublicKey(this.order.solMint).toBase58();
                            amountSpecified = BigInt(this.order.solAmount);
                            if (this.order.triggerPriceUsd === null) {
                                throw new Error(`expected trigger price usd for order ${this.order.id}`);
                            }
                            triggerPriceUsd = new Decimal(this.order.triggerPriceUsd);
                            swapType = SwapType.LowerPriceSwap;
                            otherAmountThreshold = null;
                            break;
                        }
                        case TradingOrderType.SwapSellForAutoTradeBaseIn: {
                            if (this.order.tokenAmount === null ||
                                this.order.tokenNormalizedAmount === null) {
                                throw new Error(`token amount should not be null for ${this.order.id}`);
                            }
                            if (this.order.tokenMint === null) {
                                throw new Error(`token mint should not be null for ${this.order.id}`);
                            }
                            if (this.order.solMint === null) {
                                throw new Error(`sol mint should not be null for ${this.order.id}`);
                            }
                            baseIn = true;
                            inputMint = new web3.PublicKey(this.order.tokenMint).toBase58();
                            outputMint = new web3.PublicKey(this.order.solMint).toBase58();
                            amountSpecified = BigInt(this.order.tokenAmount as string);
                            triggerPriceUsd = null;
                            swapType = SwapType.QuickSwap;
                            if (this.order.thresholdAmount === null) {
                                throw new Error(`expected out amount for order ${this.order.id}`);
                            }
                            otherAmountThreshold = BigInt(new Decimal(this.order.thresholdAmount)
                                .mul(new Decimal(1).sub(slippage))
                                .toFixed(0));
                            break;
                        }
                        case TradingOrderType.SwapSellForAutoTradeBaseOut: {
                            if (this.order.solAmount === null ||
                                this.order.solNormalizedAmount === null) {
                                throw new Error(`token amount should not be null for ${this.order.id}`);
                            }
                            if (this.order.tokenMint === null) {
                                throw new Error(`token mint should not be null for ${this.order.id}`);
                            }
                            if (this.order.solMint === null) {
                                throw new Error(`sol mint should not be null for ${this.order.id}`);
                            }
                            baseIn = false;
                            inputMint = new web3.PublicKey(this.order.tokenMint).toBase58();
                            outputMint = new web3.PublicKey(this.order.solMint).toBase58();
                            amountSpecified = BigInt(this.order.solAmount);
                            triggerPriceUsd = null;
                            swapType = SwapType.QuickSwap;
                            if (this.order.thresholdAmount === null) {
                                throw new Error(`expected out amount for order ${this.order.id}`);
                            }
                            otherAmountThreshold = BigInt(new Decimal(this.order.thresholdAmount)
                                .mul(new Decimal(1).add(slippage))
                                .toFixed(0));
                            break;
                        }
                        case TradingOrderType.SwapSell:
                        case TradingOrderType.LimitSell: {
                            if (this.order.tokenAmount === null ||
                                this.order.tokenNormalizedAmount === null) {
                                throw new Error(`token amount should not be null for ${this.order.id}`);
                            }
                            if (this.order.tokenMint === null) {
                                throw new Error(`token mint should not be null for ${this.order.id}`);
                            }
                            if (this.order.solMint === null) {
                                throw new Error(`sol mint should not be null for ${this.order.id}`);
                            }
                            baseIn = true;
                            inputMint = new web3.PublicKey(this.order.tokenMint).toBase58();
                            outputMint = new web3.PublicKey(this.order.solMint).toBase58();
                            amountSpecified = BigInt(this.order.tokenAmount as string);
                            if (this.order.orderType === TradingOrderType.SwapSell) {
                                triggerPriceUsd = null;
                                swapType = SwapType.QuickSwap;
                                if (this.order.thresholdAmount === null) {
                                    throw new Error(`expected out amount for order ${this.order.id}`);
                                }
                                otherAmountThreshold = BigInt(new Decimal(this.order.thresholdAmount)
                                    .mul(new Decimal(1).sub(slippage))
                                    .toFixed(0));
                            }
                            else {
                                if (this.order.triggerPriceUsd === null) {
                                    throw new Error(`expected trigger price usd for order ${this.order.id}`);
                                }
                                triggerPriceUsd = new Decimal(this.order.triggerPriceUsd);
                                swapType = SwapType.LowerPriceSwap;
                                otherAmountThreshold = null;
                            }
                            break;
                        }
                        case TradingOrderType.NativeDeposit:
                        case TradingOrderType.NativeWithdraw:
                        case TradingOrderType.TokenDeposit:
                        case TradingOrderType.TokenWithdraw: {
                            throw new Error(`unknown order type ${this.order.orderType}`);
                        }
                        default: {
                            assertNever(this.order.orderType);
                        }
                    }
                    let status;
                    let txId;
                    let errorReason;
                    try {
                        if (this.order.isAntiMev === null) {
                            throw new Error(`expected isAntiMev for ${this.order.id}`);
                        }
                        if (this.order.briberyAmount === null) {
                            throw new Error(`expected briberyAmount for ${this.order.id}`);
                        }
                        if (this.order.priorityFee === null) {
                            throw new Error(`expected priorityFee for ${this.order.id}`);
                        }
                        if (this.order.pool === null) {
                            throw new Error(`expected pool for ${this.order.id}`);
                        }
                        // Flag this swap as SELL if it's any of the sell order types. The
                        // Rust trading server uses this for retry-policy routing: sells must
                        // eventually exit (up to 3× retry with tip escalation), buys are more
                        // conservative (no retry on slippage).
                        const isSell =
                            this.order.orderType === TradingOrderType.AutoTradeSell ||
                            this.order.orderType === TradingOrderType.SwapSell ||
                            this.order.orderType === TradingOrderType.LimitSell ||
                            this.order.orderType === TradingOrderType.SwapSellForAutoTradeBaseIn ||
                            this.order.orderType === TradingOrderType.SwapSellForAutoTradeBaseOut;
                        const ret = await this.tradingClient.swap({
                            swapType,
                            triggerPriceUsd,
                            amountSpecified,
                            baseIn,
                            isAntiMev: this.order.isAntiMev,
                            briberyAmount: BigInt(this.order.briberyAmount),
                            feeRate: new Decimal(0.01),
                            inputMint,
                            orderId: this.order.id,
                            outputMint,
                            otherAmountThreshold,
                            poolId: new web3.PublicKey(this.order.pool).toBase58(),
                            maxPriorityFee: BigInt(this.order.priorityFee),
                            tradingAccountPda: new web3.PublicKey(this.order.walletAddress).toBase58(),
                            slippage: new Decimal(this.order.slippage),
                            consensusVotes: (this.order as any).consensusVotes ?? 0,
                            isSell,
                        });
                        status = ret.status;
                        txId = ret.txId;
                        errorReason = ret.errorReason;
                    }
                    catch (error) {
                        if (error instanceof BadRequestException) {
                            status = SwapTransactionStatus.Failed;
                            errorReason = error.message;
                            txId = null;
                        }
                        else {
                            throw error;
                        }
                    }
                    switch (status) {
                        case SwapTransactionStatus.Created: {
                            break;
                        }
                        case SwapTransactionStatus.Success:
                        case SwapTransactionStatus.Failed:
                        case SwapTransactionStatus.Cancelled: {
                            const order = await this.tradingOrderRepository.findOneBy({
                                id: this.order.id,
                            });
                            if (order === null) {
                                throw new Error(`expected order ${this.order.id}`);
                            }
                            this.order = order;
                            if (this.order.status === TradingOrderStatus.Created) {
                                if (!isNullOrUndefined(txId)) {
                                    this.order.txId = Buffer.from(bs58.decode(txId as string));
                                }
                                if (status === SwapTransactionStatus.Success) {
                                    if (isNullOrUndefined(txId)) {
                                        throw new Error('expected tx id');
                                    }
                                    const dexTrades = await this.clickHouseService.dexTradesByTxId(txId as string, Math.floor(this.order.createdAt.getTime() / 1000), 1);
                                    if (dexTrades.length <= 0) {
                                        throw new BadRequestException('expected dex trade');
                                    }
                                    const dexTrade = dexTrades[0];
                                    const confirmedTime = new Date(Number(dexTrade.data.blockTime) * 1000);
                                    switch (this.order.orderType) {
                                        case TradingOrderType.AutoTradeBuy:
                                        case TradingOrderType.SwapBuy:
                                        case TradingOrderType.LimitBuy: {
                                            const usdAmount = new Decimal(dexTrade.data.usdValue).abs();
                                            const tokenNormalizedAmount = dexTrade.tokenNormalizedAmount();
                                            const tokenAmount = dexTrade.tokenAmount();
                                            const solNormalizedAmount = this.order.solNormalizedAmount;
                                            if (solNormalizedAmount === null) {
                                                throw new Error('expected sol normalized amount');
                                            }
                                            this.order.tokenAmount = tokenAmount.toFixed(0);
                                            this.order.tokenNormalizedAmount =
                                                tokenNormalizedAmount.toString();
                                            this.order.tokenUsdPrice = new Decimal(tokenNormalizedAmount).eq(0)
                                                ? '0'
                                                : usdAmount
                                                    .div(tokenNormalizedAmount)
                                                    .toFixed(USD_PRECISION);
                                            this.order.solUsdPrice = new Decimal(solNormalizedAmount).eq(0)
                                                ? '0'
                                                : usdAmount
                                                    .div(solNormalizedAmount)
                                                    .toFixed(USD_PRECISION);
                                            this.order.usdAmount = usdAmount.toFixed(USD_PRECISION);
                                            this.order.confirmedTime = confirmedTime;
                                            break;
                                        }
                                        case TradingOrderType.AutoTradeSell:
                                        case TradingOrderType.SwapSellForAutoTradeBaseOut: {
                                            const usdAmount = new Decimal(dexTrade.data.usdValue).abs();
                                            const tokenNormalizedAmount = dexTrade.tokenNormalizedAmount();
                                            const tokenAmount = dexTrade.tokenAmount();
                                            const solNormalizedAmount = this.order.solNormalizedAmount;
                                            if (solNormalizedAmount === null) {
                                                throw new Error('expected sol normalized amount');
                                            }
                                            this.order.tokenAmount = tokenAmount.toFixed(0);
                                            this.order.tokenNormalizedAmount =
                                                tokenNormalizedAmount.toString();
                                            this.order.tokenUsdPrice = new Decimal(tokenNormalizedAmount).eq(0)
                                                ? '0'
                                                : usdAmount
                                                    .div(tokenNormalizedAmount)
                                                    .toFixed(USD_PRECISION);
                                            this.order.solUsdPrice = new Decimal(solNormalizedAmount).eq(0)
                                                ? '0'
                                                : usdAmount
                                                    .div(solNormalizedAmount)
                                                    .toFixed(USD_PRECISION);
                                            this.order.usdAmount = usdAmount.toFixed(USD_PRECISION);
                                            this.order.confirmedTime = confirmedTime;
                                            break;
                                        }
                                        case TradingOrderType.SwapSell:
                                        case TradingOrderType.SwapSellForAutoTradeBaseIn:
                                        case TradingOrderType.LimitSell: {
                                            const usdAmount = new Decimal(dexTrade.data.usdValue).abs();
                                            const solNormalizedAmount = dexTrade.solNormalizedAmount();
                                            const solAmount = dexTrade.solAmount();
                                            const tokenNormalizedAmount = this.order.tokenNormalizedAmount as string;
                                            if (tokenNormalizedAmount === null) {
                                                throw new Error(`expected token normalized amount for ${this.order.id}`);
                                            }
                                            this.order.solAmount = solAmount.toFixed(0);
                                            this.order.solNormalizedAmount =
                                                solNormalizedAmount.toString();
                                            this.order.solUsdPrice = new Decimal(solNormalizedAmount).eq(0)
                                                ? '0'
                                                : usdAmount
                                                    .div(solNormalizedAmount)
                                                    .toFixed(USD_PRECISION);
                                            this.order.tokenUsdPrice = new Decimal(tokenNormalizedAmount).eq(0)
                                                ? '0'
                                                : usdAmount
                                                    .div(tokenNormalizedAmount)
                                                    .toFixed(USD_PRECISION);
                                            this.order.usdAmount = usdAmount.toFixed(USD_PRECISION);
                                            this.order.confirmedTime = confirmedTime;
                                            break;
                                        }
                                        case TradingOrderType.NativeDeposit:
                                        case TradingOrderType.NativeWithdraw:
                                        case TradingOrderType.TokenDeposit:
                                        case TradingOrderType.TokenWithdraw: {
                                            break;
                                        }
                                        default: {
                                            assertNever(this.order.orderType);
                                        }
                                    }
                                }
                                this.order.status = getTradingOrderStatus(status);
                                this.order.errorReason = errorReason;
                                this.order.updatedAt = new Date();
                                if (this.order.status === TradingOrderStatus.Success) {
                                    const queryRunner = this.dataSource.createQueryRunner();
                                    await queryRunner.connect();
                                    await queryRunner.startTransaction();
                                    try {
                                        const wallet = await queryRunner.manager.findOne(Wallet, {
                                            where: {
                                                address: this.order.walletAddress,
                                            },
                                            lock: { mode: 'pessimistic_write' },
                                        });
                                        if (wallet === null) {
                                            throw new UnknownError(`wallet ${this.order.walletAddress} not found`);
                                        }
                                        if (this.order.tokenMint === null) {
                                            throw new Error(`token mint should not be null for ${this.order.id}`);
                                        }
                                        let walletOrderStatistic = await queryRunner.manager.findOne(WalletOrderStatistic, {
                                            where: {
                                                walletId: wallet.id,
                                                tokenAddr: this.order.tokenMint,
                                            },
                                        });
                                        if (walletOrderStatistic === null) {
                                            walletOrderStatistic =
                                                this.walletOrderStatisticRepository.create({
                                                    id: v7(),
                                                    walletId: wallet.id,
                                                    tokenAddr: this.order.tokenMint,
                                                    buyTxsCount: '0',
                                                    sellTxsCount: '0',
                                                    totalTxsCount: '0',
                                                    buyAmountUsd: '0',
                                                    sellAmountUsd: '0',
                                                    buyNormalizedAmount: '0',
                                                    sellNormalizedAmount: '0',
                                                    realizedProfit: '0',
                                                    createdAt: new Date(),
                                                    updatedAt: new Date(),
                                                });
                                        }
                                        walletOrderStatistic.updatedAt = new Date();
                                        wallet.updatedAt = new Date();
                                        let event = null;
                                        switch (this.order.orderType) {
                                            case TradingOrderType.AutoTradeBuy:
                                            case TradingOrderType.SwapBuy:
                                            case TradingOrderType.LimitBuy: {
                                                wallet.buyTxsCount = (BigInt(wallet.buyTxsCount) + 1n).toString();
                                                wallet.tradingTxCount = (BigInt(wallet.tradingTxCount) + 1n).toString();
                                                wallet.totalBuyAmountUsd = new Decimal(wallet.totalBuyAmountUsd)
                                                    .add(new Decimal(this.order.usdAmount as string))
                                                    .toString();
                                                walletOrderStatistic.buyTxsCount = (BigInt(walletOrderStatistic.buyTxsCount) + 1n).toString();
                                                walletOrderStatistic.totalTxsCount = (BigInt(walletOrderStatistic.totalTxsCount) + 1n).toString();
                                                walletOrderStatistic.buyAmountUsd = new Decimal(walletOrderStatistic.buyAmountUsd)
                                                    .add(this.order.usdAmount as string)
                                                    .toString();
                                                walletOrderStatistic.buyNormalizedAmount = new Decimal(walletOrderStatistic.buyNormalizedAmount)
                                                    .add(this.order.tokenNormalizedAmount as string)
                                                    .toString();
                                                if (this.order.orderType === TradingOrderType.AutoTradeBuy) {
                                                    if (this.order.remoteId === null) {
                                                        throw new Error('expected remote id');
                                                    }
                                                    event = await queryRunner.manager.findOne(AutomaticStrategyEvent, {
                                                        where: {
                                                            id: this.order.remoteId,
                                                        },
                                                        lock: { mode: 'pessimistic_write' },
                                                    });
                                                    if (event === null) {
                                                        throw new Error('expected event');
                                                    }
                                                    event.autoTradeStatus = AutomaticTradeStatus.Pending;
                                                    event.autoTradeReservedAmount = new Decimal(event.autoTradeReservedAmount || '0')
                                                        .add(this.order.tokenAmount as string)
                                                        .toFixed();
                                                    event.autoTradeReservedNormalizedAmount = new Decimal(event.autoTradeReservedNormalizedAmount || '0')
                                                        .add(this.order.tokenNormalizedAmount as string)
                                                        .toFixed();
                                                }
                                                break;
                                            }
                                            case TradingOrderType.AutoTradeSell:
                                            case TradingOrderType.SwapSellForAutoTradeBaseIn:
                                            case TradingOrderType.SwapSellForAutoTradeBaseOut:
                                            case TradingOrderType.SwapSell:
                                            case TradingOrderType.LimitSell: {
                                                wallet.sellTxsCount = (BigInt(wallet.sellTxsCount) + 1n).toString();
                                                wallet.tradingTxCount = (BigInt(wallet.tradingTxCount) + 1n).toString();
                                                wallet.totalSellAmountUsd = new Decimal(wallet.totalSellAmountUsd)
                                                    .add(new Decimal(this.order.usdAmount as string))
                                                    .toString();
                                                walletOrderStatistic.sellTxsCount = (BigInt(walletOrderStatistic.sellTxsCount) + 1n).toString();
                                                walletOrderStatistic.totalTxsCount = (BigInt(walletOrderStatistic.totalTxsCount) + 1n).toString();
                                                walletOrderStatistic.sellAmountUsd = new Decimal(walletOrderStatistic.sellAmountUsd)
                                                    .add(this.order.usdAmount as string)
                                                    .toString();
                                                walletOrderStatistic.sellNormalizedAmount = new Decimal(walletOrderStatistic.sellNormalizedAmount)
                                                    .add(this.order.tokenNormalizedAmount as string)
                                                    .toString();
                                                const profit = new Decimal(this.order.tokenUsdPrice as string)
                                                    .sub(new Decimal(walletOrderStatistic.buyNormalizedAmount).gt(0)
                                                    ? new Decimal(walletOrderStatistic.buyAmountUsd).div(walletOrderStatistic.buyNormalizedAmount)
                                                    : 0)
                                                    .mul(this.order.tokenNormalizedAmount as string);
                                                // Per-token realized profit must accumulate on its OWN previous value,
                                                // not on the wallet-wide total. The old code accidentally duplicated
                                                // the wallet-wide total into the per-token stat on every sell.
                                                walletOrderStatistic.realizedProfit = new Decimal(walletOrderStatistic.realizedProfit || '0')
                                                    .add(profit)
                                                    .toFixed(USD_PRECISION);
                                                wallet.realizedProfitUsd = new Decimal(wallet.realizedProfitUsd)
                                                    .add(profit)
                                                    .toFixed(USD_PRECISION);
                                                if (this.order.orderType ===
                                                    TradingOrderType.SwapSellForAutoTradeBaseOut ||
                                                    this.order.orderType ===
                                                        TradingOrderType.AutoTradeSell ||
                                                    this.order.orderType ===
                                                        TradingOrderType.SwapSellForAutoTradeBaseIn) {
                                                    if (this.order.remoteId === null) {
                                                        throw new Error('expected remote id');
                                                    }
                                                    event = await queryRunner.manager.findOne(AutomaticStrategyEvent, {
                                                        where: {
                                                            id: this.order.remoteId,
                                                        },
                                                        lock: { mode: 'pessimistic_write' },
                                                    });
                                                    if (event === null) {
                                                        throw new Error('expected event');
                                                    }
                                                    const autoTradeReservedNormalizedAmount = new Decimal(event.autoTradeReservedNormalizedAmount || '0').sub(this.order.tokenNormalizedAmount as string);
                                                    event.autoTradeReservedNormalizedAmount =
                                                        autoTradeReservedNormalizedAmount.toFixed();
                                                    const autoTradeReservedAmount = new Decimal(event.autoTradeReservedAmount || '0').sub(this.order.tokenAmount as string);
                                                    event.autoTradeReservedAmount =
                                                        autoTradeReservedAmount.toFixed();
                                                    event.updatedAt = new Date();
                                                    if (autoTradeReservedNormalizedAmount.lte(0) &&
                                                        event.autoTradeStatus ===
                                                            AutomaticTradeStatus.Pending) {
                                                        event.autoTradeStatus =
                                                            AutomaticTradeStatus.Completed;
                                                    }
                                                }
                                                break;
                                            }
                                            case TradingOrderType.NativeDeposit:
                                            case TradingOrderType.NativeWithdraw:
                                            case TradingOrderType.TokenDeposit:
                                            case TradingOrderType.TokenWithdraw: {
                                                break;
                                            }
                                            default: {
                                                assertNever(this.order.orderType);
                                            }
                                        }
                                        await queryRunner.manager.save(wallet);
                                        await queryRunner.manager.save(walletOrderStatistic);
                                        if (event !== null) {
                                            await queryRunner.manager.save(event);
                                        }
                                        if (this.nextOrder) {
                                            const nextOrder = await queryRunner.manager.findOne(TradingOrder, {
                                                where: {
                                                    id: this.nextOrder.id,
                                                },
                                                lock: { mode: 'pessimistic_write' },
                                            });
                                            if (nextOrder === null) {
                                                throw new Error('expected next order');
                                            }
                                            this.nextOrder = nextOrder;
                                            if (this.nextOrder.status ===
                                                TradingOrderStatus.WaitingStart) {
                                                if (this.order.tokenAmount === null) {
                                                    this.logger.error(`token amount should not be null for ${this.order.id}`);
                                                    throw new Error(`token amount should not be null for ${this.order.id}`);
                                                }
                                                this.nextOrder.thresholdAmount = new Decimal(this.order.tokenAmount as string)
                                                    .div(DOUBLE_SELL_PRICE_MULTIPLIER)
                                                    .toFixed(0);
                                                if (this.order.tokenNormalizedAmount === null) {
                                                    this.logger.error(`token normalized amount should not be null for ${this.order.id}`);
                                                    throw new Error(`token normalized amount should not be null for ${this.order.id}`);
                                                }
                                                if (this.order.tokenUsdPrice === null) {
                                                    this.logger.error(`token usd price should not be null for ${this.order.id}`);
                                                    throw new Error(`token usd price should not be null for ${this.order.id}`);
                                                }
                                                this.nextOrder.thresholdNormalizedAmount = new Decimal(this.order.tokenNormalizedAmount as string)
                                                    .div(DOUBLE_SELL_PRICE_MULTIPLIER)
                                                    .toFixed();
                                                this.nextOrder.triggerPriceUsd = new Decimal(this.order.tokenUsdPrice as string)
                                                    .mul(DOUBLE_SELL_PRICE_MULTIPLIER)
                                                    .toFixed();
                                                this.nextOrder.status = TradingOrderStatus.Created;
                                                this.nextOrder.updatedAt = new Date();
                                                await queryRunner.manager.save(this.nextOrder);
                                            }
                                        }
                                        this.order = await queryRunner.manager.save(this.order);
                                        await queryRunner.commitTransaction();
                                    }
                                    catch (error) {
                                        await queryRunner.rollbackTransaction();
                                        this.logger.error(`failed to update wallet and wallet order statistic for order ${this.order.id}, error: ${error}`);
                                        throw error;
                                    }
                                    finally {
                                        await queryRunner.release();
                                    }
                                    if (this.nextOrder) {
                                        new PendingOrder(this.nextOrder, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.messageNotifyService, this.tradingSettingRepository).wait();
                                    }
                                    switch (this.order.orderType) {
                                        case TradingOrderType.LimitBuy: {
                                            this.messageNotifyService.notifyLimitBuySuccess(this.order);
                                            break;
                                        }
                                        case TradingOrderType.LimitSell: {
                                            this.messageNotifyService.notifyLimitSellSuccess(this.order);
                                            break;
                                        }
                                        case TradingOrderType.SwapBuy: {
                                            this.messageNotifyService.notifySwapBuySuccess(this.order);
                                            break;
                                        }
                                        case TradingOrderType.SwapSell: {
                                            this.messageNotifyService.notifySwapSellSuccess(this.order);
                                            break;
                                        }
                                        case TradingOrderType.SwapSellForAutoTradeBaseIn: {
                                            this.messageNotifyService.notifySwapSellForAutoTradeBaseInSuccess(this.order);
                                            break;
                                        }
                                        case TradingOrderType.SwapSellForAutoTradeBaseOut: {
                                            this.messageNotifyService.notifySwapSellForAutoTradeBaseOutSuccess(this.order);
                                            break;
                                        }
                                        case TradingOrderType.AutoTradeBuy: {
                                            if (this.order.remoteId === null) {
                                                throw new Error('expected remote id');
                                            }
                                            const event = await this.automaticStrategyEventRepository.findOne({
                                                where: {
                                                    id: this.order.remoteId,
                                                },
                                            });
                                            if (event === null) {
                                                throw new Error('expected event');
                                            }
                                            this.messageNotifyService.notifyAutoTradeBuySuccess(this.order, event.strategyId);
                                            break;
                                        }
                                        case TradingOrderType.AutoTradeSell: {
                                            if (this.order.remoteId === null) {
                                                throw new Error('expected remote id');
                                            }
                                            const event = await this.automaticStrategyEventRepository.findOne({
                                                where: {
                                                    id: this.order.remoteId,
                                                },
                                            });
                                            if (event === null) {
                                                throw new Error('expected event');
                                            }
                                            this.messageNotifyService.notifyAutoTradeSellSuccess(this.order, event.strategyId);
                                            break;
                                        }
                                        case TradingOrderType.NativeDeposit:
                                        case TradingOrderType.NativeWithdraw:
                                        case TradingOrderType.TokenDeposit:
                                        case TradingOrderType.TokenWithdraw: {
                                            break;
                                        }
                                        default: {
                                            assertNever(this.order.orderType);
                                        }
                                    }
                                    // Track buy positions for stop loss / trailing stop monitoring
                                    if (this.positionMonitorService &&
                                        (this.order.orderType === TradingOrderType.SwapBuy ||
                                         this.order.orderType === TradingOrderType.LimitBuy ||
                                         this.order.orderType === TradingOrderType.AutoTradeBuy)) {
                                        try {
                                            const tokenUsdPrice = this.order.tokenUsdPrice as string ?? '0';
                                            const trackedPosition: TrackedPosition = {
                                                orderId: this.order.id,
                                                tokenMint: new web3.PublicKey(this.order.tokenMint!).toBase58(),
                                                entryPriceUsd: tokenUsdPrice,
                                                entryTimeMs: Date.now(),
                                                currentPriceUsd: tokenUsdPrice,
                                                athPriceUsd: tokenUsdPrice,
                                                athTimeMs: Date.now(),
                                                walletAddress: this.order.walletAddress?.toString() ?? '',
                                                userId: this.order.userId,
                                                strategyId: this.order.remoteId ?? '',
                                                remainingRatio: '1.0',
                                                sourceWalletAddress: '',
                                                sourceWalletSellRatio: '0',
                                            };
                                            await this.positionMonitorService.trackPosition(trackedPosition);
                                            this.logger.log(`Position tracked for order ${this.order.id}`);
                                        } catch (posErr) {
                                            this.logger.error(`Failed to track position for ${this.order.id}: ${posErr}`);
                                        }
                                    }
                                }
                                else {
                                    this.order = await this.tradingOrderRepository.save(this.order);
                                    if (this.order.status === TradingOrderStatus.Failed) {
                                        switch (this.order.orderType) {
                                            case TradingOrderType.SwapBuy:
                                            case TradingOrderType.SwapSell: {
                                                this.messageNotifyService.notifySwapFailed(this.order);
                                                break;
                                            }
                                            case TradingOrderType.LimitBuy:
                                            case TradingOrderType.LimitSell: {
                                                this.messageNotifyService.notifyLimitOrderFailed(this.order);
                                                break;
                                            }
                                            case TradingOrderType.AutoTradeBuy: {
                                                if (this.order.remoteId === null) {
                                                    throw new Error('expected remote id');
                                                }
                                                const event = await this.automaticStrategyEventRepository.findOne({
                                                    where: {
                                                        id: this.order.remoteId,
                                                    },
                                                });
                                                if (event === null) {
                                                    throw new Error('expected event');
                                                }
                                                this.messageNotifyService.notifyAutoTradeBuyFailed(this.order, event.strategyId);
                                                break;
                                            }
                                            case TradingOrderType.AutoTradeSell: {
                                                if (this.order.remoteId === null) {
                                                    throw new Error('expected remote id');
                                                }
                                                const event = await this.automaticStrategyEventRepository.findOne({
                                                    where: {
                                                        id: this.order.remoteId,
                                                    },
                                                });
                                                if (event === null) {
                                                    throw new Error('expected event');
                                                }
                                                if ((this.order.errorReason || '').includes('Input token not found')) {
                                                    event.autoTradeStatus =
                                                        AutomaticTradeStatus.Completed;
                                                    event.updatedAt = new Date();
                                                    await this.automaticStrategyEventRepository.save(event);
                                                }
                                                this.messageNotifyService.notifyAutoTradeSellFailed(this.order, event.strategyId);
                                                break;
                                            }
                                            case TradingOrderType.SwapSellForAutoTradeBaseIn: {
                                                this.messageNotifyService.notifySwapSellForAutoTradeBaseInFailed(this.order);
                                                break;
                                            }
                                            case TradingOrderType.SwapSellForAutoTradeBaseOut: {
                                                this.messageNotifyService.notifySwapSellForAutoTradeBaseOutFailed(this.order);
                                                break;
                                            }
                                            case TradingOrderType.NativeDeposit:
                                            case TradingOrderType.NativeWithdraw:
                                            case TradingOrderType.TokenDeposit:
                                            case TradingOrderType.TokenWithdraw: {
                                                break;
                                            }
                                            default: {
                                                assertNever(this.order.orderType);
                                            }
                                        }
                                    }
                                }
                            }
                            return;
                        }
                        default: {
                            assertNever(status);
                        }
                    }
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                catch (error) {
                    if (error instanceof BadRequestException) {
                        if (errTimes > 3) {
                            this.logger.error(error);
                            await new Promise((resolve) => setTimeout(resolve, 300000));
                        }
                        else {
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                        }
                        errTimes++;
                    }
                    else {
                        this.logger.error(error);
                        await new Promise((resolve) => setTimeout(resolve, 20000));
                    }
                }
            }

            // U-5: If we exhausted all retries, mark the order as failed
            if (totalAttempts >= MAX_RETRY_ATTEMPTS) {
                this.logger.error(`Order ${this.order.id} exceeded max retry attempts (${MAX_RETRY_ATTEMPTS}), marking as failed`);
                try {
                    const order = await this.tradingOrderRepository.findOneBy({ id: this.order.id });
                    if (order && order.status === TradingOrderStatus.Created) {
                        order.status = TradingOrderStatus.Failed;
                        order.errorReason = `Exceeded maximum retry attempts (${MAX_RETRY_ATTEMPTS})`;
                        order.updatedAt = new Date();
                        await this.tradingOrderRepository.save(order);
                    }
                } catch (saveError) {
                    this.logger.error(`Failed to save exhausted order ${this.order.id}: ${saveError}`);
                }
            }
        }
    }
}
