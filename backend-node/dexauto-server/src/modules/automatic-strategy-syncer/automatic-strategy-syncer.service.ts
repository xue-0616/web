import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { DataSource, In, Repository } from 'typeorm';
import { AutomaticStrategy, AutomaticStrategyStatus } from '../automatic-strategy/entities/AutomaticStrategy.entity';
import { TokenService } from '../token/token.service';
import { ConfigService } from '@nestjs/config';
import { ClickHouseService, TokenPrice } from '../../infrastructure/clickhouse/clickhouse.service';
import { MessageNotifierService } from '../message-notifier/message-notifier.service';
import { WalletOrderStatistic } from '../wallet/entities/walletOrderStatistic.entity';
import { TradingOrder } from '../trading/entities/tradingOrder.entity';
import Redis from 'ioredis';
import { AccountDexTrade } from '../transfer-subscriber/transfer-subscriber.service';
import { TokenInfo } from '../token/entities/token-info.entity';
import Decimal from 'decimal.js';
import { AutomaticStrategyEventTx } from '../automatic-strategy/entities/AutomaticStrategyEventTx.entity';
import { TradingSetting } from '../trading/entities/tradingSetting.entity';
import { AutomaticStrategyEvent } from '../automatic-strategy/entities/AutomaticStrategyEvent.entity';
import { AutomaticStrategyExecutor, getAutomasticStrategyAutoTradeCacheKey, getAutomasticStrategyNotifyCacheKey } from './utils/automatic-strategy-executor';
import { InjectRepository } from '@nestjs/typeorm';
import { TradingClient } from '../../common/tradingClient';
import { Queue, Worker } from 'bullmq';
import { UnknownError } from '../../error';
import { Mutex } from 'async-mutex';
import { TokenSecurityService } from '../token-security/token-security.service';
import { WalletScorerService } from '../wallet-scorer/wallet-scorer.service';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    SmartWalletSourceService,
    SmartWalletCandidate,
} from '../smart-wallet-source/smart-wallet-source.service';
import { KpiDashboardService } from '../wallet-scorer/kpi-dashboard.service';
import { FundAllocatorService } from '../position-manager/fund-allocator';
import { EntryDeviationMonitorService } from '../position-manager/entry-deviation-monitor';
import { PositionManagerService } from '../position-manager/position-manager.service';
import { DailyLossCircuitBreakerService } from '../position-manager/daily-loss-circuit-breaker.service';
import { SocialSignalService } from '../social-signal/social-signal.service';
import { PriorityFeeOracleService } from '../trading/priority-fee-oracle.service';

const AUTOMATIC_STRATEGY_SYNCER_QUEUE = `{${process.env.NODE_ENV?.toUpperCase() || 'DEV'}_DEXAUTO_STRATEGY_SYNCER_QUEUE}`;
@Injectable()
export class AutomaticStrategySyncerService {
    logger: PinoLogger;
    automaticStrategyRepository: Repository<AutomaticStrategy>;
    automaticStrategyEventTxRepository: Repository<AutomaticStrategyEventTx>;
    automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>;
    tradingOrderRepository: Repository<TradingOrder>;
    walletOrderStatisticRepository: Repository<WalletOrderStatistic>;
    tradingSettingRepository: Repository<TradingSetting>;
    tokenService: TokenService;
    notifyService: MessageNotifierService;
    dataSource: DataSource;
    clickHouseService: ClickHouseService;
    redisClient: Redis;
    automaticStrategies: Map<string, AutomaticStrategyExecutor>;
    chainFMLock: Mutex;
    tradingClient: TradingClient;
    tokenSecurityService: TokenSecurityService;
    walletScorerService?: WalletScorerService;
    smartWalletSourceService?: SmartWalletSourceService;
    kpiDashboardService?: KpiDashboardService;
    fundAllocatorService?: FundAllocatorService;
    entryDeviationMonitor?: EntryDeviationMonitorService;
    positionManagerService?: PositionManagerService;
    dailyLossCircuitBreaker?: DailyLossCircuitBreakerService;
    socialSignalService?: SocialSignalService;
    priorityFeeOracle?: PriorityFeeOracleService;
    queue: Queue;
    worker?: Worker;
    queueFunc?: (addresses: string[]) => void;
    constructor(
        @InjectPinoLogger(AutomaticStrategySyncerService.name) logger: PinoLogger,
        @InjectRepository(AutomaticStrategy) automaticStrategyRepository: Repository<AutomaticStrategy>,
        @InjectRepository(AutomaticStrategyEventTx) automaticStrategyEventTxRepository: Repository<AutomaticStrategyEventTx>,
        @InjectRepository(AutomaticStrategyEvent) automaticStrategyEventRepository: Repository<AutomaticStrategyEvent>,
        @InjectRepository(TradingOrder) tradingOrderRepository: Repository<TradingOrder>,
        @InjectRepository(WalletOrderStatistic) walletOrderStatisticRepository: Repository<WalletOrderStatistic>,
        @InjectRepository(TradingSetting) tradingSettingRepository: Repository<TradingSetting>,
        tokenService: TokenService,
        notifyService: MessageNotifierService,
        dataSource: DataSource,
        clickHouseService: ClickHouseService,
        configService: ConfigService,
        @Inject('REDIS_CLIENT') redisClient: Redis,
        tokenSecurityService: TokenSecurityService,
        @Optional() walletScorerService?: WalletScorerService,
        @Optional() smartWalletSourceService?: SmartWalletSourceService,
        @Optional() kpiDashboardService?: KpiDashboardService,
        @Optional() fundAllocatorService?: FundAllocatorService,
        @Optional() entryDeviationMonitor?: EntryDeviationMonitorService,
        @Optional() positionManagerService?: PositionManagerService,
        @Optional() dailyLossCircuitBreaker?: DailyLossCircuitBreakerService,
        @Optional() socialSignalService?: SocialSignalService,
        @Optional() priorityFeeOracle?: PriorityFeeOracleService,
    ) {
        this.logger = logger;
        this.automaticStrategyRepository = automaticStrategyRepository;
        this.automaticStrategyEventTxRepository = automaticStrategyEventTxRepository;
        this.automaticStrategyEventRepository = automaticStrategyEventRepository;
        this.tradingOrderRepository = tradingOrderRepository;
        this.walletOrderStatisticRepository = walletOrderStatisticRepository;
        this.tradingSettingRepository = tradingSettingRepository;
        this.tokenService = tokenService;
        this.notifyService = notifyService;
        this.dataSource = dataSource;
        this.clickHouseService = clickHouseService;
        this.redisClient = redisClient;
        this.automaticStrategies = new Map();
        this.chainFMLock = new Mutex();
        this.tradingClient = new TradingClient(configService.getOrThrow('tradingServerUrl'));
        this.tokenSecurityService = tokenSecurityService;
        this.walletScorerService = walletScorerService;
        this.smartWalletSourceService = smartWalletSourceService;
        this.kpiDashboardService = kpiDashboardService;
        this.fundAllocatorService = fundAllocatorService;
        this.entryDeviationMonitor = entryDeviationMonitor;
        this.positionManagerService = positionManagerService;
        this.dailyLossCircuitBreaker = dailyLossCircuitBreaker;
        this.socialSignalService = socialSignalService;
        this.priorityFeeOracle = priorityFeeOracle;
        this.queue = new Queue(AUTOMATIC_STRATEGY_SYNCER_QUEUE, {
            connection: this.redisClient,
        });
    }
    async initStrategies(): Promise<void> {
        let times = 0;
        while (true) {
            try {
                const strategies = await this.automaticStrategyRepository.findBy({
                    status: In([
                        AutomaticStrategyStatus.Active,
                        AutomaticStrategyStatus.Inactive,
                    ]),
                });
                for (const strategy of strategies) {
                    this.automaticStrategies.set(strategy.id, new AutomaticStrategyExecutor(this.notifyService, this.tokenService, strategy, this.automaticStrategyRepository, this.automaticStrategyEventTxRepository, this.automaticStrategyEventRepository, this.tradingOrderRepository, this.tradingClient, this.clickHouseService, this.walletOrderStatisticRepository, this.tradingSettingRepository, this.dataSource, this.redisClient, this.chainFMLock, undefined, this.tokenSecurityService, this.walletScorerService, this.kpiDashboardService, this.fundAllocatorService, this.entryDeviationMonitor, this.positionManagerService, this.dailyLossCircuitBreaker, this.socialSignalService, this.priorityFeeOracle));
                }
                break;
            }
            catch (error) {
                if (times % 30 === 0) {
                    this.logger.error(`init strategies failed: ${(error as Error).message}`);
                }
                times++;
                await new Promise((resolve) => setTimeout(resolve, 10000));
            }
        }
        this.logger.info(`init strategies success`);

        // Register callback for real-time removal when a wallet is demoted to C tier (Strike)
        if (this.walletScorerService) {
            this.walletScorerService.registerOnDemotedCallback((address: string) => {
                let removedFrom = 0;
                for (const [, executor] of this.automaticStrategies) {
                    const monitor = executor.monitorAddresses.get(address);
                    // Only remove dynamically-added wallets (name starts with "Smart[")
                    if (monitor && monitor.name?.startsWith('Smart[')) {
                        executor.monitorAddresses.delete(address);
                        removedFrom++;
                    }
                }
                if (removedFrom > 0) {
                    this.logger.warn(
                        `Real-time Strike removal: ${address.slice(0, 8)}... removed from ${removedFrom} strategy executors`,
                    );
                }
            });
        }

        // Register callback for real-time sync when new active wallets are discovered
        if (this.smartWalletSourceService) {
            this.smartWalletSourceService.registerActiveWalletsChangedCallback(
                (addresses: string[]) => {
                    this.logger.info(
                        `Real-time sync: ${addresses.length} new active wallets detected, injecting into executors`,
                    );
                    this.syncDynamicSmartWallets().catch((err) => {
                        this.logger.error(`Real-time dynamic wallet sync failed: ${(err as Error)}`);
                    });
                },
            );
            // Do an initial sync immediately
            await this.syncDynamicSmartWallets();
        }
    }
    async initQueue(queueFunc: any) {
        this.queueFunc = queueFunc;
        while (true) {
            try {
                if (!this.worker) {
                    this.worker = new Worker(AUTOMATIC_STRATEGY_SYNCER_QUEUE, async (job) => {
                        this.logger.info(`Job ${job.id} started, get strategies: ${job.data}`);
                        const strategies = await this.automaticStrategyRepository.find({
                            where: {
                                id: In(job.data),
                            },
                        });
                        this.logger.info(`Job ${job.id} found strategies: ${strategies.map((s) => s.id).join(', ')}`);
                        const addresses = new Map();
                        for (const strategy of strategies) {
                            const oldStrategy = this.automaticStrategies.get(strategy.id);
                            this.automaticStrategies.delete(strategy.id);
                            if (oldStrategy) {
                                oldStrategy.destroy();
                            }
                            const strategyExecutor = new AutomaticStrategyExecutor(this.notifyService, this.tokenService, strategy, this.automaticStrategyRepository, this.automaticStrategyEventTxRepository, this.automaticStrategyEventRepository, this.tradingOrderRepository, this.tradingClient, this.clickHouseService, this.walletOrderStatisticRepository, this.tradingSettingRepository, this.dataSource, this.redisClient, this.chainFMLock, this.queueFunc, this.tokenSecurityService, this.walletScorerService, this.kpiDashboardService, this.fundAllocatorService, this.entryDeviationMonitor, this.positionManagerService, this.dailyLossCircuitBreaker, this.socialSignalService, this.priorityFeeOracle);
                            this.automaticStrategies.set(strategy.id, strategyExecutor);
                        }
                    }, { connection: this.redisClient, removeOnComplete: { count: 1000 } });
                    this.worker.on('completed', (job) => {
                        this.logger.info(`Job ${job.id} completed`);
                    });
                    this.worker.on('failed', (job, err) => {
                        this.logger.error(`Job ${job?.id} failed: ${(err as Error)}`);
                    });
                    this.worker.on('error', (err) => {
                        this.logger.error(`Worker error: ${(err as Error)}`);
                    });
                }
                const isRunning = this.worker.isRunning();
                if (!isRunning) {
                    await this.worker.run();
                }
                break;
            }
            catch (error) {
                this.logger.error(`init queue failed: ${(error as Error).message}`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
        this.logger.info(`init queue success`);
    }
    monitorAddresses(): string[] {
        const addresses = new Map<string, boolean>();
        // Strategy hardcoded addresses
        for (const strategy of this.automaticStrategies.values()) {
            for (const address of strategy.monitorAddresses.values()) {
                addresses.set(address.address, true);
            }
        }
        // Dynamic smart wallet pool (S/A tier active)
        if (this.smartWalletSourceService) {
            for (const addr of this.smartWalletSourceService.getSystemMonitorAddresses()) {
                addresses.set(addr, true);
            }
        }
        return Array.from(addresses.keys());
    }
    syncAccountDexTrades(accountDexTrades: any, tokenUsdPrices: any, tokenInfos: any, solUsdPrice: any): void {
        this.logger.info(`Sync account dex trades, dex trades: ${JSON.stringify(accountDexTrades)}`);
        for (const strategy of this.automaticStrategies.values()) {
            // Fire-and-forget: per-token error handling is inside the executor,
            // but add a top-level `.catch()` to prevent unhandled promise rejections
            // from crashing the Node process if executor-level code throws synchronously
            // before its inner try/catch.
            strategy
                .syncAccountDexTradesWithLock(accountDexTrades, tokenUsdPrices, tokenInfos, solUsdPrice)
                .catch((err) => {
                    this.logger.error(
                        `syncAccountDexTradesWithLock failed for strategy ${strategy.strategy?.id}: ${(err as Error)}`,
                    );
                });
        }
    }

    /**
     * Periodically merge dynamic smart wallet pool into all strategy executors.
     * Runs every 5 minutes — syncs S/A tier active wallets from SmartWalletSourceService
     * into each executor's monitorAddresses map so they participate in trigger evaluation.
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async syncDynamicSmartWallets(): Promise<void> {
        if (!this.smartWalletSourceService) return;

        const dynamicAddresses = this.smartWalletSourceService.getSystemMonitorAddresses();
        const dynamicSet = new Set(dynamicAddresses);

        // Build a lookup of candidates for name/metadata
        const candidateMap = new Map<string, SmartWalletCandidate>();
        for (const addr of dynamicAddresses) {
            const candidate = this.smartWalletSourceService.getCandidate(addr);
            if (candidate) candidateMap.set(addr, candidate);
        }

        let totalAdded = 0;
        let totalRemoved = 0;
        for (const strategy of this.automaticStrategies.values()) {
            let added = 0;
            // Add new S/A wallets
            for (const addr of dynamicAddresses) {
                if (!strategy.monitorAddresses.has(addr)) {
                    const candidate = candidateMap.get(addr);
                    strategy.monitorAddresses.set(addr, {
                        address: addr,
                        name: candidate?.name
                            ?? `Smart[${candidate?.tier ?? '?'}] ${addr.slice(0, 8)}`,
                    });
                    added++;
                }
            }
            totalAdded += added;

            // Remove wallets that are no longer S/A active (e.g., Strike-demoted to C tier).
            // Only remove dynamically-added entries (prefixed with "Smart[") — never touch
            // addresses from ChainFM subscriptions or other static sources.
            let removed = 0;
            for (const [addr, monitor] of strategy.monitorAddresses.entries()) {
                if (monitor.name?.startsWith('Smart[') && !dynamicSet.has(addr)) {
                    strategy.monitorAddresses.delete(addr);
                    removed++;
                }
            }
            totalRemoved += removed;
        }

        if (totalAdded > 0 || totalRemoved > 0) {
            this.logger.info(
                `Synced dynamic smart wallets: ${dynamicAddresses.length} active, ` +
                `+${totalAdded} added, -${totalRemoved} removed ` +
                `across ${this.automaticStrategies.size} strategies`,
            );

            // Notify gRPC subscriber to update subscriptions
            if (this.queueFunc) {
                this.queueFunc(dynamicAddresses);
            }
        }
    }
    async addStrategies(strategyIds: any): Promise<void> {
        try {
            await this.queue.add(AUTOMATIC_STRATEGY_SYNCER_QUEUE, strategyIds);
        }
        catch (error) {
            this.logger.error(`add strategy failed: ${error}`);
            throw new UnknownError(error);
        }
    }
    async getStrategyNotify24hCount(id: any): Promise<{ id: string; count: string }> {
        const now = new Date();
        const nowMills = now.getTime();
        const key = getAutomasticStrategyNotifyCacheKey(id);
        const count = await this.redisClient.zcount(key, nowMills - 24 * 60 * 60 * 1000, nowMills);
        return { id, count: count.toString() };
    }
    async getStrategyAutoTrade24hCount(id: any): Promise<{ id: string; count: string }> {
        const now = new Date();
        const nowMills = now.getTime();
        const key = getAutomasticStrategyAutoTradeCacheKey(id);
        const count = await this.redisClient.zcount(key, nowMills - 24 * 60 * 60 * 1000, nowMills);
        return { id, count: count.toString() };
    }
}
