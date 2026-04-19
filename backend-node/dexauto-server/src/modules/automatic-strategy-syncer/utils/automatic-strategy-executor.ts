import { DataSource, Repository, In } from 'typeorm';
import { WalletScorerService } from '../../wallet-scorer/wallet-scorer.service';
import { AutomaticStrategy as AutomaticStrategyEntity, MonitorAddress, AutomaticStrategyStatus, AutoTradeStatus, AutoTradeSellType, TriggerItemType, getChainFMChannelId, pickWalletForTrade } from '../../automatic-strategy/entities/AutomaticStrategy.entity';
import { AccountDexTrade } from '../../transfer-subscriber/transfer-subscriber.service';
import { Redis } from 'ioredis';
import { Mutex } from 'async-mutex';
import Decimal from 'decimal.js';
import { AutomaticStrategyEvent, AutomaticStrategyEventData, AutomaticTradeStatus } from '../../automatic-strategy/entities/AutomaticStrategyEvent.entity';
import { ClickHouseService, TokenPrice } from '../../../infrastructure/clickhouse/clickhouse.service';
import { TokenInfo } from '../../token/entities/token-info.entity';
import { MessageNotifierService } from '../../message-notifier/message-notifier.service';
import { TradingOrder } from '../../trading/entities/tradingOrder.entity';
import { TokenService } from '../../token/token.service';
import { TradingClient } from '../../../common/tradingClient';
import { WalletOrderStatistic } from '../../wallet/entities/walletOrderStatistic.entity';
import { AutomaticStrategyEventTx } from '../../automatic-strategy/entities/AutomaticStrategyEventTx.entity';
import { TradingSetting } from '../../trading/entities/tradingSetting.entity';
import { ChainFMClient } from './chainFMClient';
import bs58 from 'bs58';
import { UnknownError } from '../../../error';
import { v7 } from 'uuid';
import { NotifyDataType } from '../../message-notifier/entities/notify.entity';
import { PendingOrder } from '../../../common/pendingOrder';
import { Chain } from '../../../common/genericChain';
import { assertNever, isNullOrUndefined } from '../../../common/utils';
import { Logger } from '@nestjs/common';
import { TokenSecurityService } from '../../token-security/token-security.service';
import { CopyTradeFilter, applyCopyTradeFilter, parseCopyTradeFilter, TokenFilterContext } from './copy-trade-filter';
import { KpiDashboardService } from '../../wallet-scorer/kpi-dashboard.service';
import { FundAllocatorService } from '../../position-manager/fund-allocator';
import { EntryDeviationMonitorService } from '../../position-manager/entry-deviation-monitor';
import { PositionManagerService } from '../../position-manager/position-manager.service';
import { DailyLossCircuitBreakerService } from '../../position-manager/daily-loss-circuit-breaker.service';
import { SocialSignalService } from '../../social-signal/social-signal.service';
import { PriorityFeeOracleService } from '../../trading/priority-fee-oracle.service';

const CACHE_EXPIRATION_SECS = 60 * 60 * 24 * 2;
const VALID_STRATEGY_MILLISECONDS = 1000 * 60 * 60 * 24;
const VALID_STRATEGY_DEX_TRADE_SECONDS = 60 * 2;
export interface StrategyTrigger {
    index: number;
    tokenMint: string;
    data: { items: any[] };
    validTxs: any[];
}

export const DOUBLE_SELL_PRICE_MULTIPLIER = 2;

export class AutomaticStrategyExecutor {
    notifyService: MessageNotifierService;
    tokenService: TokenService;
    strategy: AutomaticStrategyEntity;
    automaticStrategyRepository: Repository<AutomaticStrategyEntity>;
    automaticStrategyEventTxRepository: Repository<AutomaticStrategyEventTx>;
    automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>;
    tradingOrderRepository: Repository<TradingOrder>;
    tradingClient: TradingClient;
    clickHouseService: ClickHouseService;
    walletOrderStatisticRepository: Repository<WalletOrderStatistic>;
    tradingSettingRepository: Repository<TradingSetting>;
    dataSource: DataSource;
    redisClient: Redis;
    chainFMLock: Mutex;
    queueFunc?: (addresses: string[]) => void;
    tokenSecurityService?: TokenSecurityService;
    walletScorerService?: WalletScorerService;
    copyTradeFilter: CopyTradeFilter;
    isUpdatingAddressSub: boolean;
    syncAccountDexTradesLock: Mutex;
    /** Per-token Mutex for parallel processing of different tokens within same strategy */
    tokenLocks: Map<string, Mutex>;
    logger: any;
    monitorAddresses: Map<string, MonitorAddress>;
    chainFMClient: ChainFMClient;
    kpiDashboardService?: KpiDashboardService;
    fundAllocatorService?: FundAllocatorService;
    entryDeviationMonitor?: EntryDeviationMonitorService;
    positionManagerService?: PositionManagerService;
    dailyLossCircuitBreaker?: DailyLossCircuitBreakerService;
    socialSignalService?: SocialSignalService;
    priorityFeeOracle?: PriorityFeeOracleService;
    constructor(notifyService: MessageNotifierService, tokenService: TokenService, strategy: AutomaticStrategyEntity, automaticStrategyRepository: Repository<AutomaticStrategyEntity>, automaticStrategyEventTxRepository: Repository<AutomaticStrategyEventTx>, automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>, tradingOrderRepository: Repository<TradingOrder>, tradingClient: TradingClient, clickHouseService: ClickHouseService, walletOrderStatisticRepository: Repository<WalletOrderStatistic>, tradingSettingRepository: Repository<TradingSetting>, dataSource: DataSource, redisClient: Redis, chainFMLock: Mutex, queueFunc?: (addresses: string[]) => void, tokenSecurityService?: TokenSecurityService, walletScorerService?: WalletScorerService, kpiDashboardService?: KpiDashboardService, fundAllocatorService?: FundAllocatorService, entryDeviationMonitor?: EntryDeviationMonitorService, positionManagerService?: PositionManagerService, dailyLossCircuitBreaker?: DailyLossCircuitBreakerService, socialSignalService?: SocialSignalService, priorityFeeOracle?: PriorityFeeOracleService) {
        this.notifyService = notifyService;
        this.tokenService = tokenService;
        this.strategy = strategy;
        this.automaticStrategyRepository = automaticStrategyRepository;
        this.automaticStrategyEventTxRepository = automaticStrategyEventTxRepository;
        this.automaticStrategyEventRepository = automaticStrategyEventRepository;
        this.tradingOrderRepository = tradingOrderRepository;
        this.tradingClient = tradingClient;
        this.clickHouseService = clickHouseService;
        this.walletOrderStatisticRepository = walletOrderStatisticRepository;
        this.tradingSettingRepository = tradingSettingRepository;
        this.dataSource = dataSource;
        this.redisClient = redisClient;
        this.chainFMLock = chainFMLock;
        this.queueFunc = queueFunc;
        this.tokenSecurityService = tokenSecurityService;
        this.walletScorerService = walletScorerService;
        this.kpiDashboardService = kpiDashboardService;
        this.fundAllocatorService = fundAllocatorService;
        this.entryDeviationMonitor = entryDeviationMonitor;
        this.positionManagerService = positionManagerService;
        this.dailyLossCircuitBreaker = dailyLossCircuitBreaker;
        this.socialSignalService = socialSignalService;
        this.priorityFeeOracle = priorityFeeOracle;
        this.copyTradeFilter = parseCopyTradeFilter((strategy as any).copyTradeFilter);
        this.isUpdatingAddressSub = true;
        this.syncAccountDexTradesLock = new Mutex();
        this.tokenLocks = new Map();
        this.logger = new Logger(AutomaticStrategyExecutor.name);
        this.monitorAddresses = new Map();
        for (const monitorAddress of strategy.monitorAddresses) {
            this.monitorAddresses.set(monitorAddress.address, monitorAddress);
        }
        this.chainFMClient = new ChainFMClient();
        this.queueFunc?.(Array.from(this.monitorAddresses.keys()));
        this.updateAddressSub();
    }
    destroy(): void {
        this.isUpdatingAddressSub = false;
    }
    async updateAddressSub(): Promise<void> {
        const subChainFMChannelIds = this.strategy.addressSubs
            .map((sub) => getChainFMChannelId(sub.url))
            .filter((channelId) => channelId !== null);
        while (this.isUpdatingAddressSub) {
            const release = await this.chainFMLock.acquire();
            this.logger.log('Start to update address sub for strategy ' + this.strategy.id);
            try {
                let isLogged = false;
                for (const subChainFMChannelId of subChainFMChannelIds) {
                    let channelInfo;
                    try {
                        channelInfo =
                            await this.chainFMClient.getChannelInfo(subChainFMChannelId);
                    }
                    catch (error) {
                        if (!isLogged) {
                            this.logger.error(`Failed to get channel info for ${subChainFMChannelId}: ${error}`);
                            isLogged = true;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 1000 * 1));
                        continue;
                    }
                    const updatedAddresses = [];
                    for (const address of channelInfo.addresses) {
                        const monitorAddress = this.monitorAddresses.get(address.address);
                        if (!monitorAddress) {
                            this.monitorAddresses.set(address.address, {
                                address: address.address,
                                name: (address as any).name || '',
                            });
                            updatedAddresses.push(address.address);
                        }
                    }
                    if (updatedAddresses.length > 0) {
                        this.queueFunc?.(updatedAddresses);
                        this.logger.log(`add sub addresses ${updatedAddresses.join(', ')}`);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 1000 * 1));
                }
                this.logger.log('Update address sub success for strategy ' + this.strategy.id);
            }
            catch (error) {
                this.logger.error(`Failed to update address sub for ${this.strategy.id}: ${error}`);
            }
            finally {
                release();
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * 3600));
        }
    }
    async syncAccountDexTradesWithLock(accountDexTrades: any, tokenUsdPrices: any, tokenInfos: any, solUsdPrice: any): Promise<void> {
        if (this.strategy.status !== AutomaticStrategyStatus.Active) return;

        // Group trades by token mint for per-token parallel processing.
        // Trades for the same token must be serialized (Redis ZSet ordering matters),
        // but different tokens can run concurrently — eliminating the bottleneck where
        // a slow RPC call for token A blocks signals for token B.
        const byToken = new Map<string, any[]>();
        for (const trade of accountDexTrades) {
            const blockTime = parseInt(trade.block_time);
            if (!Number.isInteger(blockTime) ||
                Math.abs(blockTime - new Date().getTime() / 1000) > VALID_STRATEGY_DEX_TRADE_SECONDS) {
                continue;
            }
            const monitorAddress = this.monitorAddresses.get(trade.trader);
            if (!monitorAddress) continue;

            const mint = trade.base_mint;
            if (!byToken.has(mint)) byToken.set(mint, []);
            byToken.get(mint)!.push({ trade, monitorAddress });
        }

        // Process each token group with its own Mutex — parallel across tokens
        const promises: Promise<void>[] = [];
        for (const [mint, trades] of byToken) {
            if (!this.tokenLocks.has(mint)) {
                this.tokenLocks.set(mint, new Mutex());
            }
            const tokenMutex = this.tokenLocks.get(mint)!;

            promises.push(
                tokenMutex.runExclusive(async () => {
                    for (const { trade, monitorAddress } of trades) {
                        await this.syncAccountDexTrade(trade, monitorAddress, tokenUsdPrices, tokenInfos, solUsdPrice);
                    }
                }).catch((err) => {
                    this.logger.error(`Token ${mint.slice(0, 8)}... sync failed: ${(err as Error)}`);
                }),
            );
        }

        await Promise.all(promises);

        // Prune stale token locks (tokens not seen in 10 min)
        if (this.tokenLocks.size > 200) {
            const staleTokens: string[] = [];
            for (const [mint, mutex] of this.tokenLocks) {
                if (!mutex.isLocked()) staleTokens.push(mint);
            }
            for (const mint of staleTokens.slice(0, staleTokens.length - 50)) {
                this.tokenLocks.delete(mint);
            }
        }
    }
    async syncAccountDexTrade(accountDexTrade: any, monitorAddress: any, tokenUsdPrices: any, tokenInfos: any, solUsdPrice: any): Promise<void> {
        const signalStartMs = Date.now();
        this.kpiDashboardService?.recordSignal();

        const tokenUsdPrice = tokenUsdPrices.get(accountDexTrade.base_mint);
        if (!tokenUsdPrice) {
            return;
        }
        const tokenMint = accountDexTrade.base_mint;
        const tokenInfo = tokenInfos.get(tokenMint);
        if (!tokenInfo || !tokenInfo.symbol) {
            return;
        }
        const txCacheKey = getAutomaticStrategyTxCacheKey(accountDexTrade.tx_id);
        const tokenCacheKey = getAutomaticStrategyTokenCacheKey(this.strategy.id, accountDexTrade.base_mint);
        const strategyAccountDexTrade = {
            trade: accountDexTrade,
            monitorAddress: monitorAddress,
            tokenSymbol: tokenInfo.symbol,
            tokenIcon: tokenInfo.icon,
        };
        const now = new Date();
        const nowMills = now.getTime();
        try {
            const txIds = await this.redisClient.zrangebyscore(tokenCacheKey, Math.max(nowMills - VALID_STRATEGY_MILLISECONDS, ((this.strategy.triggerStartAt || this.strategy.startAt) as Date).getTime()), nowMills);
            const txIdsMap = new Map();
            for (const txId of txIds) {
                txIdsMap.set(txId, true);
            }
            if (txIdsMap.has(accountDexTrade.tx_id)) {
                return;
            }
            const txs = [];
            if (txIds.length > 0) {
                (await Promise.all(txIds.map((txId) => {
                    const txIdKey = getAutomaticStrategyTxCacheKey(txId);
                    return this.redisClient.get(txIdKey);
                }))).forEach((tx) => {
                    if (tx) {
                        txs.push(JSON.parse(tx));
                    }
                });
            }
            txIds.push(accountDexTrade.tx_id);
            txs.push(strategyAccountDexTrade);
            // ── Advanced copy trade filter (Phase 3.4) ──
            // positionIncreaseCount = how many previous buys already cached for this token
            // (txs includes the current one, so subtract 1)
            const tradeSolAmount = new Decimal(accountDexTrade.usd_value || '0')
                .div(solUsdPrice).toNumber();

            // Compute estimated price impact for LPI manipulation detection.
            // For constant-product AMM: impact ≈ tradeAmount / poolQuoteLiquidity
            let estimatedPriceImpact: number | undefined;
            const tokenPriceInfo = tokenUsdPrices.get(tokenMint);
            if (tokenPriceInfo?.quoteVaultBalance) {
                const poolSolLiquidity = tokenPriceInfo.quoteVaultBalance.div(1e9).toNumber();
                if (poolSolLiquidity > 0) {
                    estimatedPriceImpact = tradeSolAmount / poolSolLiquidity;
                }
            }

            const filterCtx: TokenFilterContext = {
                tokenMint,
                solAmountPerAddress: tradeSolAmount,
                positionIncreaseCount: Math.max(0, txs.length - 1),
                estimatedPriceImpact,
            };
            const filterResult = applyCopyTradeFilter(this.copyTradeFilter, filterCtx);
            if (!filterResult.passes) {
                this.logger.warn(`Token ${tokenMint} filtered out: ${filterResult.reason}`);
                this.kpiDashboardService?.recordFilteredSignal();
                return;
            }

            // ── Layer 10: Social signal check ──
            // Hard reject on coordinated campaign detection (KOL shilling). This
            // complements the on-chain filter which can't see off-chain narrative
            // manipulation. Gracefully degrades to neutral when no provider is set.
            if (this.socialSignalService) {
                try {
                    const socialSignal = await this.socialSignalService.getTokenSignal(tokenMint);
                    if (this.socialSignalService.isCoordinatedCampaign(socialSignal)) {
                        this.logger.warn(
                            `Token ${tokenMint} filtered out by social signal: coordinated campaign detected ` +
                            `(tweets/hr=${socialSignal?.tweetsPerHour.toFixed(1)}, ` +
                            `KOLs=${socialSignal?.kolMentions.length})`,
                        );
                        this.kpiDashboardService?.recordFilteredSignal();
                        return;
                    }
                } catch (err) {
                    // Social signal is best-effort — don't fail the trade on provider errors
                    this.logger.warn(`Social signal check errored for ${tokenMint}: ${(err as Error)}`);
                }
            }

            // ── Probe buy detection with Pending Confirmation (Phase 5.2) ──
            // If the wallet's buy amount is far below its historical average position size,
            // this is likely a "test buy" / "seat reservation" / bait.
            //
            // Instead of skipping outright, we use Pending_Confirmation:
            //   1. First probe buy → cache it in Redis (60s TTL), add to token ZSet,
            //      but SKIP trigger evaluation (don't fire a trade yet)
            //   2. Follow-up buy from same wallet+token within 60s → probe confirmed,
            //      merge both and proceed to trigger evaluation normally
            //
            // This handles "scaling-in" smart money: small buy to test → big buy to commit.
            // 60s window covers typical "test → commit" pattern without missing rapid moves.
            // Threshold: current buy < 10% of wallet's avgPositionSize (or recentAvgPositionSize) → probe
            const PROBE_RATIO_THRESHOLD = 0.1;
            const PROBE_TTL_SECS = 60;
            let isProbe = false;

            if (this.walletScorerService) {
                const walletScore = this.walletScorerService.getScore(accountDexTrade.trader);
                const recentAvg = walletScore?.metrics?.recentAvgPositionSize ?? 0;
                const avgPos = walletScore?.metrics?.avgPositionSize ?? 0;
                const refAvg = recentAvg > 0 ? recentAvg : avgPos;
                if (walletScore && refAvg > 0) {
                    const buySolAmount = new Decimal(accountDexTrade.usd_value || '0')
                        .div(solUsdPrice).toNumber();
                    const ratio = buySolAmount / refAvg;

                    // Cluster consensus override: if multiple OTHER wallets are also buying
                    // this same token with small amounts, this is likely a "narrative shift"
                    // (e.g., whales entering a new low-cap sector), not a probe.
                    // Count unique ENTITIES (Sybil cluster deduplicated) in recent ZSet:
                    let effectiveThreshold = PROBE_RATIO_THRESHOLD;
                    if (ratio < PROBE_RATIO_THRESHOLD && txs.length > 0) {
                        const otherAddresses = txs
                            .filter(tx => tx.monitorAddress?.address !== accountDexTrade.trader)
                            .map(tx => tx.monitorAddress?.address)
                            .filter(Boolean);
                        // Deduplicate by Sybil cluster: addresses sharing the same funding source
                        // count as 1 entity, not N. Prevents Cabal from gaming the threshold.
                        const uniqueEntities = this.walletScorerService
                            ? this.walletScorerService.countUniqueEntities(otherAddresses)
                            : new Set(otherAddresses).size;
                        // 2+ independent entities buying same token → lower probe threshold
                        // 1 independent entity → slight reduction
                        if (uniqueEntities >= 2) {
                            effectiveThreshold = PROBE_RATIO_THRESHOLD * 0.3; // 10% → 3%
                            this.logger.log(
                                `Probe threshold relaxed ${PROBE_RATIO_THRESHOLD} → ${effectiveThreshold.toFixed(3)} ` +
                                `for ${tokenMint.slice(0, 8)}...: ${uniqueEntities} independent entities ` +
                                `also buying (cluster-deduplicated consensus)`,
                            );
                        } else if (uniqueEntities === 1) {
                            effectiveThreshold = PROBE_RATIO_THRESHOLD * 0.6; // 10% → 6%
                        }
                    }

                    if (ratio < effectiveThreshold) {
                        const probeKey = `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:PROBE_BUY:${this.strategy.id}:${accountDexTrade.trader}:${tokenMint}`;
                        const existingProbe = await this.redisClient.get(probeKey);

                        if (existingProbe) {
                            // Follow-up buy after a previous probe → probe CONFIRMED
                            // Delete probe marker and proceed to trigger evaluation
                            await this.redisClient.del(probeKey);
                            this.logger.log(
                                `Probe CONFIRMED: ${accountDexTrade.trader.slice(0, 8)}... ` +
                                `follow-up buy on ${tokenMint.slice(0, 8)}... ` +
                                `(${buySolAmount.toFixed(2)} SOL, ${(ratio * 100).toFixed(1)}% of avg). ` +
                                `Merging with prior probe — proceeding to trigger evaluation`,
                            );
                            // isProbe = false → will proceed to validateStrategyTrigger
                        } else {
                            // First probe buy → cache and defer trigger evaluation
                            await this.redisClient.setex(probeKey, PROBE_TTL_SECS, JSON.stringify({
                                trader: accountDexTrade.trader,
                                tokenMint,
                                txId: accountDexTrade.tx_id,
                                buySolAmount,
                                ratio,
                                timestamp: nowMills,
                            }));
                            isProbe = true;
                            this.logger.warn(
                                `Probe buy PENDING: ${accountDexTrade.trader.slice(0, 8)}... ` +
                                `bought ${buySolAmount.toFixed(2)} SOL on ${tokenMint.slice(0, 8)}... ` +
                                `(${(ratio * 100).toFixed(1)}% of avg ${refAvg.toFixed(2)} SOL) ` +
                                `— deferring trigger for ${PROBE_TTL_SECS}s pending confirmation`,
                            );
                        }
                    } else {
                        // Normal-sized buy — also check if there's a pending probe to confirm
                        const probeKey = `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:PROBE_BUY:${this.strategy.id}:${accountDexTrade.trader}:${tokenMint}`;
                        const existingProbe = await this.redisClient.get(probeKey);
                        if (existingProbe) {
                            await this.redisClient.del(probeKey);
                            this.logger.log(
                                `Probe CONFIRMED by full-size buy: ${accountDexTrade.trader.slice(0, 8)}... ` +
                                `committed ${buySolAmount.toFixed(2)} SOL on ${tokenMint.slice(0, 8)}... ` +
                                `after prior probe — proceeding to trigger evaluation`,
                            );
                        }
                    }
                }
            }

            // If this is an unconfirmed probe, save to Redis but skip trigger evaluation.
            // The swap IS already in the token ZSet, so when the follow-up arrives,
            // both swaps will be included in trigger evaluation.
            if (isProbe) {
                await this.redisClient.setex(txCacheKey, CACHE_EXPIRATION_SECS, JSON.stringify(strategyAccountDexTrade));
                await this.redisClient.expire(tokenCacheKey, CACHE_EXPIRATION_SECS);
                await this.redisClient.zadd(tokenCacheKey, now.getTime(), accountDexTrade.tx_id);
                return;
            }

            const strategyTriggers = this.validateStrategyTrigger(tokenMint, solUsdPrice, txs);
            if (strategyTriggers.length !== 0) {
                for (const strategyTrigger of strategyTriggers) {
                    const txIds = strategyTrigger.data.items[0].txs.map((tx: any) => Buffer.from(bs58.decode(tx.txId)));
                    const eventTx = await this.automaticStrategyEventTxRepository.findOneBy({
                        strategyId: this.strategy.id,
                        triggerIndex: strategyTrigger.index,
                        tokenMint: Buffer.from(bs58.decode(tokenMint)),
                        txId: In(txIds),
                    });
                    if (!eventTx) {
                        const now = new Date();
                        let notifyInfo = null;
                        if (this.strategy.isSysNotifyOn) {
                            notifyInfo = await this.notifyService.getUserNotifyInfo(this.strategy.userId);
                        }
                        let pool = null;
                        if (this.strategy.autoTradeStatus === AutoTradeStatus.Active &&
                            this.strategy.autoTrades.length > 0) {
                            // Global daily-loss circuit breaker: block new buys when this user
                            // has crossed today's max-loss threshold. Events + notifications
                            // still fire so the operator sees signals, only `pool` is cleared
                            // to skip auto-trade.
                            if (this.dailyLossCircuitBreaker &&
                                await this.dailyLossCircuitBreaker.isTradingPaused(this.strategy.userId)) {
                                const pnl = await this.dailyLossCircuitBreaker.getTodayPnlSol(this.strategy.userId);
                                this.logger.warn(
                                    `Auto-trade SKIPPED for ${strategyTrigger.tokenMint}: ` +
                                    `daily loss circuit breaker active for user ${this.strategy.userId} ` +
                                    `(today pnl=${pnl.toFixed(3)} SOL)`,
                                );
                            } else {
                                // Cross-strategy dedup: if multiple strategies under the same user
                                // fire for the same token within a short window, only ONE should
                                // actually place the buy. Without this, a user with 3 similar
                                // strategies (e.g., Sniper + Narrative + Diamond) all watching
                                // overlapping smart-money sets would triple up on the same token.
                                //
                                // Use SET NX with a 30-second TTL — first strategy that lands
                                // the lock wins; others silently abort auto-trade but keep
                                // events/notifications so the operator sees all signals.
                                const dedupKey = `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:USER_TOKEN_LOCK:${this.strategy.userId}:${strategyTrigger.tokenMint}`;
                                const acquired = await this.redisClient.set(
                                    dedupKey,
                                    this.strategy.id,
                                    'EX',
                                    30,
                                    'NX',
                                );
                                if (!acquired) {
                                    const holder = await this.redisClient.get(dedupKey);
                                    this.logger.warn(
                                        `Auto-trade SKIPPED for ${strategyTrigger.tokenMint}: ` +
                                        `strategy ${holder} already executing on this (user, token) within 30s window`,
                                    );
                                } else {
                                    const tokenInfoForPool = await this.tokenService.getTokenInfoByMint(strategyTrigger.tokenMint, null) as any;
                                    pool = tokenInfoForPool?.pool_address ?? null;
                                    if (!pool) {
                                        this.logger.warn(`No pool found for token ${strategyTrigger.tokenMint}, skipping auto-trade`);
                                    }
                                }
                            }
                        }
                        // ════════ Token Security Check (v2.1) ════════
                        // Multi-layer check BEFORE creating any orders:
                        // Layer 1:   Mint/Freeze authority (~50ms)
                        // Layer 1.5: Token-2022 extensions — PermanentDelegate, TransferHook,
                        //            NonTransferable, ConfidentialTransfer (~50ms)
                        // Layer 2:   RugCheck API trust score + risk level (~200ms)
                        // Layer 3:   Liquidity, holder concentration, LP burnt ratio (~100ms)
                        if (this.tokenSecurityService) {
                            try {
                                const securityResult = await this.tokenSecurityService.checkTokenSecurity(strategyTrigger.tokenMint);
                                if (!securityResult.passesFilter) {
                                    this.logger.warn(
                                        `Token ${strategyTrigger.tokenMint} REJECTED by security check: ${securityResult.reason} ` +
                                        `[risk=${securityResult.riskLevel}, score=${securityResult.score}, ${securityResult.checkDurationMs}ms]`
                                    );
                                    this.kpiDashboardService?.recordFilteredSignal();
                                    if (securityResult.riskLevel === 'HIGH') {
                                        this.kpiDashboardService?.recordRugPullDetected(true);
                                    }
                                    return;
                                }
                                this.logger.log(
                                    `Token ${strategyTrigger.tokenMint} PASSED security check: ` +
                                    `score=${securityResult.score}, risk=${securityResult.riskLevel}, ` +
                                    `isToken2022=${securityResult.checks.isToken2022}, ${securityResult.checkDurationMs}ms`
                                );
                            } catch (secError) {
                                // Fail-safe: reject token if security check itself errors
                                this.logger.error(`Token security check error for ${strategyTrigger.tokenMint}: ${(secError as Error).message}`);
                                return;
                            }
                        }
                        // ════════ End Token Security Check ════════

                        const strategySetting = await this.tradingSettingRepository.findOne({
                            where: { userId: this.strategy.userId, chain: Chain.Solana },
                        });
                        if (!strategySetting) {
                            this.logger.error(`Strategy setting not found for user ${this.strategy.userId}`);
                            return;
                        }
                        let notify: any = null;
                        let tradingOrders: any[] = [];
                        let event: any;
                        const queryRunner = this.dataSource.createQueryRunner();
                        await queryRunner.connect();
                        await queryRunner.startTransaction();
                        try {
                            const strategy = await queryRunner.manager.findOne(AutomaticStrategyEntity, {
                                where: {
                                    id: this.strategy.id,
                                },
                                lock: { mode: 'pessimistic_write' },
                            });
                            if (strategy === null) {
                                throw new UnknownError(`strategy ${this.strategy.id} not found`);
                            }
                            event = new AutomaticStrategyEvent();
                            event.id = v7();
                            event.strategyId = this.strategy.id;
                            event.tokenMint = Buffer.from(bs58.decode(accountDexTrade.base_mint)) as any;
                            event.tokenSymbol = tokenInfo.symbol || '';
                            event.tokenIcon = tokenInfo.icon || '';
                            if (notifyInfo !== null) {
                                const { title, body } = this.notifyService.getAutoStrategyNotification(notifyInfo.language, this.strategy.name, strategyTrigger.index, tokenInfo.symbol, tokenUsdPrice.latestPrice, tokenUsdPrice.latestPrice
                                    .mul(tokenInfo.supply)
                                    .div(new Decimal(10).pow(tokenInfo.decimals))) as { title: string; body: string };
                                notify = await this.notifyService.saveMessage(this.strategy.userId, {
                                    type: NotifyDataType.AutoStrategyNotify,
                                    title,
                                    body,
                                    strategyId: this.strategy.id,
                                }, queryRunner);
                                strategy.notifyExecCount = (BigInt(strategy.notifyExecCount) + 1n).toString();
                                event.notifyId = notify.id;
                            }
                            else {
                                event.notifyId = null;
                            }
                            if (pool) {
                                // ════════ Fund Allocation + Entry Deviation Check ════════
                                // Determine optimal trade size based on consensus score, available funds,
                                // and entry price deviation from smart money.
                                let fundAllocationReason: string | undefined;
                                let allocatedSolAmount: number | undefined;
                                let skipAutoTrade = false;
                                // Tier-weighted consensus score (S=3, A=2, B=1) for fund-allocator
                                // tier matching. Falls back to unique-address count when the scorer
                                // is unavailable, so all triggers still get a sensible allocation.
                                const uniqueTraders = Array.from(
                                    new Set(
                                        strategyTrigger.validTxs.map(
                                            (tx: any) => tx.monitorAddress.address as string,
                                        ),
                                    ),
                                );
                                const weightedScore = this.walletScorerService
                                    ? this.walletScorerService.calculateWeightedConsensus(uniqueTraders)
                                    : uniqueTraders.length;

                                if (this.fundAllocatorService && this.entryDeviationMonitor) {
                                    // Compute smart money's weighted avg entry from trigger trades.
                                    // Each validTx has trade.usd_value (total USD) and trade.base_amount (raw tokens).
                                    // The implied per-token price = usd_value / base_amount.
                                    // We compare this with the current pool price to estimate our entry deviation.
                                    let smTotalUsd = new Decimal(0);
                                    let smTotalTokens = new Decimal(0);
                                    for (const vtx of strategyTrigger.validTxs) {
                                        const usd = new Decimal(vtx.trade.usd_value || '0');
                                        const tokens = new Decimal(vtx.trade.base_amount || '0').abs();
                                        if (usd.gt(0) && tokens.gt(0)) {
                                            smTotalUsd = smTotalUsd.add(usd);
                                            smTotalTokens = smTotalTokens.add(tokens);
                                        }
                                    }
                                    const smartMoneyAvgPrice = smTotalTokens.gt(0)
                                        ? smTotalUsd.div(smTotalTokens).toFixed()
                                        : tokenUsdPrice.latestPrice.toFixed();
                                    // Our quote price: current pool price (we'll pay this + slippage)
                                    const ourQuotePrice = tokenUsdPrice.latestPrice.toFixed();

                                    const deviationResult = this.entryDeviationMonitor.checkDeviation(
                                        smartMoneyAvgPrice, ourQuotePrice, tokenMint,
                                    );
                                    this.kpiDashboardService?.recordEntryDeviation(deviationResult.deviationPct);

                                    if (!deviationResult.proceed) {
                                        this.logger.warn(`Entry deviation too high for ${tokenMint}: ${deviationResult.reason}`);
                                        this.kpiDashboardService?.recordFilteredSignal();
                                        // Don't return — still record event + notification, but skip auto-trade
                                        skipAutoTrade = true;
                                    } else {
                                        // Calculate optimal allocation
                                        const allocResult = await this.fundAllocatorService.calculateTradeAmount(
                                            this.strategy.userId, tokenMint, weightedScore, deviationResult.deviationPct,
                                        );
                                        fundAllocationReason = allocResult.reason;
                                        if (allocResult.proceed) {
                                            allocatedSolAmount = allocResult.amountSol;
                                            this.logger.log(`Fund allocation for ${tokenMint}: ${allocResult.reason}`);
                                        } else {
                                            this.logger.warn(`Fund allocation rejected for ${tokenMint}: ${allocResult.reason}`);
                                            // Allocator says "don't trade" — skip auto-trade but keep event/notify
                                            skipAutoTrade = true;
                                        }
                                    }
                                }
                                // ════════ End Fund Allocation ════════

                                tradingOrders = [];
                                for (let autoTradeId = 0; autoTradeId < (skipAutoTrade ? 0 : this.strategy.autoTrades.length); autoTradeId++) {
                                    const autoTrade = this.strategy.autoTrades[autoTradeId];
                                    const autoTradeTradingOrders = new Map<string, string>(autoTrade.tradingOrders as [string, string][] || []);
                                    if (!autoTrade.isRepeat &&
                                        autoTradeTradingOrders.has(accountDexTrade.base_mint)) {
                                        continue;
                                    }
                                    // Use fund allocator amount if available, otherwise user-configured amount
                                    const effectiveSolAmount = allocatedSolAmount !== undefined
                                        ? Math.min(allocatedSolAmount, parseFloat(autoTrade.solNormalizedAmount)).toFixed(9)
                                        : autoTrade.solNormalizedAmount;

                                    // Wallet rotation: pick a wallet (primary or sub-wallet) randomly
                                    // per trade so MEV bots cannot fingerprint a fixed (source → follower)
                                    // pair and pre-position against us.
                                    const chosen = pickWalletForTrade(autoTrade);

                                    // Dynamic priority fee: scale user's configured base fee by
                                    // current Solana network congestion (1×-4× multiplier).
                                    // Skips this adjustment silently if the oracle has no data yet.
                                    let effectivePriorityFee = strategySetting.priorityFee;
                                    if (this.priorityFeeOracle) {
                                        try {
                                            const adjusted = await this.priorityFeeOracle.computeEffectiveFee(
                                                BigInt(strategySetting.priorityFee),
                                            );
                                            effectivePriorityFee = adjusted.toString();
                                        } catch (err) {
                                            this.logger.warn(`Priority fee oracle error, using static fee: ${(err as Error)}`);
                                        }
                                    }

                                    const buyOrder = TradingOrder.createAutoTradeOrder({
                                        userId: this.strategy.userId,
                                        tokenMint,
                                        tokenSymbol: tokenInfo.symbol,
                                        pool,
                                        walletId: chosen.walletId,
                                        walletAddress: Buffer.from(bs58.decode(chosen.walletAddress)),
                                        solUsdPrice,
                                        eventId: event.id,
                                        slippage: strategySetting.slippage,
                                        priorityFee: effectivePriorityFee,
                                        briberyAmount: strategySetting.briberyAmount,
                                        isAntiMev: strategySetting.isMevEnabled,
                                        solNormalizedAmount: effectiveSolAmount,
                                    });
                                    let sellOrder = undefined;
                                    if (autoTrade.sell) {
                                        switch (autoTrade.sell.type) {
                                            case AutoTradeSellType.DoubleSell: {
                                                sellOrder = TradingOrder.createAutoTradeSellOrder({
                                                    userId: this.strategy.userId,
                                                    tokenMint,
                                                    tokenSymbol: tokenInfo.symbol,
                                                    pool,
                                                    // Must match buyOrder's wallet so we sell from the same account
                                                    walletId: chosen.walletId,
                                                    walletAddress: Buffer.from(bs58.decode(chosen.walletAddress)),
                                                    eventId: event.id,
                                                    slippage: strategySetting.slippage,
                                                    priorityFee: effectivePriorityFee,
                                                    briberyAmount: strategySetting.briberyAmount,
                                                    isAntiMev: strategySetting.isMevEnabled,
                                                    outAmount: BigInt(buyOrder.solAmount || '0'),
                                                });
                                                break;
                                            }
                                            default:
                                                assertNever(autoTrade.sell.type);
                                        }
                                    }
                                    await queryRunner.manager.save(buyOrder);
                                    if (sellOrder) {
                                        await queryRunner.manager.save(sellOrder);
                                    }
                                    tradingOrders.push({
                                        buyOrder,
                                        sellOrder,
                                        sellType: autoTrade.sell?.type,
                                    });
                                    if (!autoTrade.isRepeat) {
                                        if (autoTrade.tradingOrders) {
                                            autoTrade.tradingOrders.push([
                                                accountDexTrade.base_mint,
                                                accountDexTrade.tx_id,
                                            ]);
                                        }
                                        else {
                                            autoTrade.tradingOrders = [
                                                [accountDexTrade.base_mint, accountDexTrade.tx_id],
                                            ];
                                        }
                                    }
                                    strategy.autoTrades[autoTradeId] = autoTrade;
                                    strategy.autoTradeExecCount = (BigInt(strategy.autoTradeExecCount) + 1n).toString();
                                }
                            }
                            event.autoTradeIds = tradingOrders
                                ? tradingOrders.map((order) => order.buyOrder.id)
                                : null;
                            event.autoTrades = tradingOrders
                                ? tradingOrders.map((order) => ({
                                    buyId: order.buyOrder.id,
                                    sellId: order.sellOrder?.id,
                                    sellType: order.sellType,
                                })) as any
                                : null;
                            event.autoTradeStatus =
                                tradingOrders.length > 0
                                    ? AutomaticTradeStatus.NotStarted
                                    : AutomaticTradeStatus.None;
                            event.triggerIndex = strategyTrigger.index;
                            event.triggerEvent = strategyTrigger.data as any;
                            event.tokenUsdPrice = tokenUsdPrice.latestPrice.toString();
                            event.createdAt = now;
                            event.updatedAt = now;
                            const eventTxs = strategyTrigger.validTxs.map((tx) => {
                                const eventTx = new AutomaticStrategyEventTx();
                                eventTx.id = v7();
                                eventTx.strategyId = this.strategy.id;
                                eventTx.eventId = event.id;
                                eventTx.txId = Buffer.from(bs58.decode(tx.trade.tx_id));
                                eventTx.triggerIndex = strategyTrigger.index;
                                eventTx.tokenMint = Buffer.from(bs58.decode(tokenMint));
                                eventTx.createdAt = now;
                                eventTx.updatedAt = now;
                                return eventTx;
                            });
                            strategy.updatedAt = now;
                            strategy.triggers[strategyTrigger.index - 1].startAt =
                                now.getTime();
                            await queryRunner.manager.save(event);
                            await queryRunner.manager.save(eventTxs);
                            await queryRunner.manager.save(strategy);
                            await queryRunner.commitTransaction();
                            this.strategy = strategy;
                        }
                        catch (err) {
                            await queryRunner.rollbackTransaction();
                            this.logger.error(`Failed to save automatic strategy event ${accountDexTrade.tx_id}: ${(err as Error)}, strategyTrigger: ${JSON.stringify(strategyTrigger)}, txs: ${JSON.stringify(txs)}`);
                            return;
                        }
                        finally {
                            await queryRunner.release();
                        }
                        if (notify !== null && notifyInfo !== null) {
                            this.notifyService.sendMessage(this.strategy.userId, notify.data, notifyInfo.tokens);
                        }
                        if (tradingOrders !== null && tradingOrders.length > 0) {
                            const tradeLatencyMs = Date.now() - signalStartMs;
                            for (const tradingOrder of tradingOrders) {
                                new PendingOrder(tradingOrder.buyOrder, this.tradingClient, this.tradingOrderRepository, this.dataSource, this.clickHouseService, this.walletOrderStatisticRepository, this.automaticStrategyEventRepository, this.notifyService, this.tradingSettingRepository, tradingOrder.sellOrder).wait();

                                // Record KPI metrics
                                this.kpiDashboardService?.recordTradeExecution(tradeLatencyMs);

                                // Record position in position manager
                                if (this.positionManagerService) {
                                    this.positionManagerService.recordBuy(
                                        this.strategy.userId,
                                        tokenMint,
                                        bs58.encode(tradingOrder.buyOrder.walletAddress),
                                        this.strategy.id,
                                        {
                                            entryId: tradingOrder.buyOrder.id,
                                            txSignature: '',
                                            tokenAmount: '0',
                                            solAmount: tradingOrder.buyOrder.solNormalizedAmount || '0',
                                            usdValue: new Decimal(tradingOrder.buyOrder.solNormalizedAmount || '0')
                                                .mul(solUsdPrice).toFixed(2),
                                            pricePerToken: tokenUsdPrice.latestPrice.toFixed(),
                                            timestampMs: Date.now(),
                                            sourceWalletAddress: accountDexTrade.trader,
                                        },
                                    ).catch((err) => {
                                        this.logger.error(`Failed to record position buy: ${(err as Error)}`);
                                    });
                                }
                            }
                        }
                        this.updateStrategyNotifyCache(event);
                        this.updateStrategyAutoTradeCache(event);
                    }
                }
                return;
            }
            await this.redisClient.setex(txCacheKey, CACHE_EXPIRATION_SECS, JSON.stringify(strategyAccountDexTrade));
            await this.redisClient.expire(tokenCacheKey, CACHE_EXPIRATION_SECS);
            await this.redisClient.zadd(tokenCacheKey, now.getTime(), accountDexTrade.tx_id);
        }
        catch (err) {
            this.logger.error(`Failed to sync account dex trade ${accountDexTrade.tx_id} to redis: ${(err as Error)}`);
        }
    }
    async updateStrategyNotifyCache(event: any): Promise<void> {
        if (event.notifyId) {
            const key = getAutomasticStrategyNotifyCacheKey(this.strategy.id);
            await this.redisClient.expire(key, CACHE_EXPIRATION_SECS);
            await this.redisClient.zadd(key, event.createdAt.getTime(), event.notifyId);
            await this.redisClient.zremrangebyscore(key, 0, event.createdAt.getTime() - VALID_STRATEGY_MILLISECONDS);
        }
    }
    async updateStrategyAutoTradeCache(event: any): Promise<void> {
        if (event.autoTradeIds && event.autoTradeIds.length > 0) {
            const key = getAutomasticStrategyAutoTradeCacheKey(this.strategy.id);
            await this.redisClient.expire(key, CACHE_EXPIRATION_SECS);
            for (const autoTradeId of event.autoTradeIds) {
                await this.redisClient.zadd(key, event.createdAt.getTime(), autoTradeId);
            }
            await this.redisClient.zremrangebyscore(key, 0, event.createdAt.getTime() - VALID_STRATEGY_MILLISECONDS);
        }
    }
    validateStrategyTrigger(tokenMint: any, solUsdPrice: any, txs: any): StrategyTrigger[] {
        const triggers = [];
        for (const trigger of this.strategy.triggers) {
            let isTriggerItem = false;
            const items = [];
            const triggerStartAt = trigger.startAt
                ? trigger.startAt
                : this.strategy.triggerStartAt
                    ? (this.strategy.triggerStartAt as any as Date).getTime()
                    : (this.strategy.startAt as any as Date).getTime();
            const validTxs = txs.filter((tx: any) => {
                return (parseInt(tx.trade.block_time) * 1000 >= triggerStartAt &&
                    tx.trade.usd_value &&
                    new Decimal(tx.trade.usd_value).gt(0));
            });
            for (const triggerItem of trigger.items) {
                switch (triggerItem.type) {
                    case TriggerItemType.PurchaseAddrUpper: {
                        isTriggerItem =
                            new Map(validTxs.map((tx: any) => [tx.monitorAddress.address, true]))
                                .size >= (triggerItem.upperAddressesCount ?? 0);
                        if (isTriggerItem) {
                            const itemTxs = new Map();
                            items.push({
                                item: triggerItem,
                                txs: validTxs
                                    .map((tx: any) => {
                                    if (itemTxs.has(tx.monitorAddress.address) ||
                                        itemTxs.size >= (triggerItem.upperAddressesCount ?? 0)) {
                                        return null;
                                    }
                                    itemTxs.set(tx.monitorAddress.address, true);
                                    const usdAmount = new Decimal(isNullOrUndefined(tx.trade.usd_value)
                                        ? '0'
                                        : tx.trade.usd_value);
                                    const tokenNormalizedAmount = new Decimal(tx.trade.base_amount).abs();
                                    const solNormalizedAmount = usdAmount.div(solUsdPrice);
                                    return {
                                        txId: tx.trade.tx_id,
                                        address: tx.monitorAddress,
                                        tokenMint: tx.trade.base_mint,
                                        tokenSymbol: tx.tokenSymbol,
                                        solNormalizedAmount: solNormalizedAmount.toFixed(),
                                        txConfirmedTime: (BigInt(tx.trade.block_time) * 1000n).toString(),
                                        tokenIcon: tx.tokenIcon,
                                        tokenNormalizedAmount: tokenNormalizedAmount.toFixed(),
                                        tokenUsdPrice: usdAmount
                                            .div(tokenNormalizedAmount)
                                            .toFixed(),
                                        usdAmount: usdAmount.toFixed(),
                                    };
                                })
                                    .filter((tx: any) => tx !== null),
                            });
                        }
                        break;
                    }
                    case TriggerItemType.PurchaseSolUpper: {
                        const triggerItemTxs: any[] = [];
                        isTriggerItem = validTxs
                            .reduce((sum: any, tx: any) => {
                            try {
                                const usdAmount = new Decimal(isNullOrUndefined(tx.trade.usd_value)
                                    ? '0'
                                    : tx.trade.usd_value);
                                const tokenNormalizedAmount = new Decimal(tx.trade.base_amount).abs();
                                const solNormalizedAmount = usdAmount.div(solUsdPrice);
                                sum = sum.add(solNormalizedAmount);
                                triggerItemTxs.push({
                                    txId: tx.trade.tx_id,
                                    address: tx.monitorAddress,
                                    tokenMint: tx.trade.base_mint,
                                    tokenSymbol: tx.tokenSymbol,
                                    solNormalizedAmount: solNormalizedAmount.toFixed(),
                                    txConfirmedTime: (BigInt(tx.trade.block_time) * 1000n).toString(),
                                    tokenIcon: tx.tokenIcon,
                                    tokenNormalizedAmount: tokenNormalizedAmount.toFixed(),
                                    tokenUsdPrice: usdAmount
                                        .div(tokenNormalizedAmount)
                                        .toFixed(),
                                    usdAmount: usdAmount.toFixed(),
                                });
                            }
                            catch (err) {
                                this.logger.error(`Failed to parse amount ${tx.trade.quote_amount} for tx ${tx.trade.tx_id}: ${(err as Error)}`);
                            }
                            return sum;
                        }, new Decimal(0))
                            .gte(triggerItem.upperSolNormalizedAmount ?? 0);
                        if (isTriggerItem) {
                            items.push({
                                item: triggerItem,
                                txs: triggerItemTxs,
                            });
                        }
                        break;
                    }
                    case TriggerItemType.PurchaseAddrAndSolUpper: {
                        const triggerItemTxs: any[] = [];
                        const triggerItemTxAddresses = new Map();
                        const triggerValidTxs = validTxs.filter((tx: any) => {
                            let solNormalizedAmount;
                            try {
                                const usdAmount = new Decimal(isNullOrUndefined(tx.trade.usd_value)
                                    ? '0'
                                    : tx.trade.usd_value);
                                solNormalizedAmount = usdAmount.div(solUsdPrice);
                            }
                            catch (err) {
                                this.logger.error(`Failed to parse amount ${tx.trade.quote_amount} for tx ${tx.trade.tx_id}: ${(err as Error)}`);
                                return false;
                            }
                            const isTriggerTx = solNormalizedAmount.gte(triggerItem.upperSolNormalizedAmount ?? 0);
                            if (isTriggerTx) {
                                if (triggerItemTxAddresses.has(tx.monitorAddress.address) ||
                                    triggerItemTxAddresses.size >= (triggerItem.addressesCount ?? 0)) {
                                    return false;
                                }
                                triggerItemTxAddresses.set(tx.monitorAddress.address, true);
                                const usdAmount = new Decimal(isNullOrUndefined(tx.trade.usd_value)
                                    ? '0'
                                    : tx.trade.usd_value);
                                const tokenNormalizedAmount = new Decimal(tx.trade.base_amount).abs();
                                triggerItemTxs.push({
                                    txId: tx.trade.tx_id,
                                    address: tx.monitorAddress,
                                    tokenMint: tx.trade.base_mint,
                                    tokenSymbol: tx.tokenSymbol,
                                    solNormalizedAmount: solNormalizedAmount.toFixed(),
                                    txConfirmedTime: (BigInt(tx.trade.block_time) * 1000n).toString(),
                                    tokenIcon: tx.tokenIcon,
                                    tokenNormalizedAmount: tokenNormalizedAmount.toFixed(),
                                    tokenUsdPrice: usdAmount.div(tokenNormalizedAmount).toFixed(),
                                    usdAmount: usdAmount.toFixed(),
                                });
                            }
                            return isTriggerTx;
                        });
                        const validAccountCount = new Map(triggerValidTxs.map((tx: any) => [tx.monitorAddress.address, true])).size;
                        isTriggerItem = validAccountCount >= (triggerItem.addressesCount ?? 0);
                        if (isTriggerItem) {
                            items.push({
                                item: triggerItem,
                                txs: triggerItemTxs,
                            });
                        }
                        break;
                    }
                    default: {
                        throw new Error('Invalid trigger item type');
                    }
                }
                if (!isTriggerItem) {
                    break;
                }
            }
            if (isTriggerItem) {
                // ── Weighted consensus gate (Phase 3) ──
                // If WalletScorerService is available, apply quality + weight checks.
                // This ensures only high-quality smart money consensus triggers buys.
                if (this.walletScorerService) {
                    const traderAddrs: string[] = Array.from(
                        new Set(validTxs.map((tx: any) => tx.monitorAddress.address as string)),
                    );
                    if (!this.walletScorerService.meetsMinimumQuality(traderAddrs)) {
                        this.logger.warn(
                            `Trigger ${trigger.index} for ${tokenMint} rejected: ` +
                            `does not meet minimum quality (need 1 S-tier or 3 A-tier)`,
                        );
                        continue;
                    }
                    const weightedScore = this.walletScorerService.calculateWeightedConsensus(traderAddrs);
                    this.logger.log(
                        `Trigger ${trigger.index} for ${tokenMint}: ` +
                        `weighted consensus=${weightedScore}, traders=${traderAddrs.length}`,
                    );
                }
                triggers.push({
                    index: trigger.index,
                    tokenMint: tokenMint,
                    data: {
                        items: items,
                    },
                    validTxs,
                });
            }
        }
        return triggers;
    }
}
export function getAutomaticStrategyTokenCacheKey(strategyId: any, token: any) {
    return `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:AUTOMATIC_STRATEGY:${strategyId}:TOKEN:${token}`;
}
export function getAutomaticStrategyTxCacheKey(txId: any) {
    return `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:AUTOMATIC_STRATEGY:TX:${txId}`;
}
export function getAutomasticStrategyNotifyCacheKey(strategyId: any) {
    return `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:AUTOMATIC_STRATEGY:${strategyId}:NOTIFY`;
}
export function getAutomasticStrategyAutoTradeCacheKey(strategyId: any) {
    return `${process.env.NODE_ENV?.toUpperCase() || 'DEV'}:DEXAUTO:AUTOMATIC_STRATEGY:${strategyId}:AUTO_TRADE`;
}
