import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeUpdate,
} from '@triton-one/yellowstone-grpc';
import { AutomaticStrategySyncerService } from '../automatic-strategy-syncer/automatic-strategy-syncer.service';
import { TokenService } from '../token/token.service';
import { FollowSellService } from './follow-sell.service';
import { BurstWalletDetectorService } from './burst-wallet-detector.service';
import { RealtimeExitLiquidityService } from './realtime-exit-liquidity.service';
import { ShredStreamPrefetchService } from './shredstream-prefetch.service';
import { parseTransaction, ParsedDexSwap } from './parsers/dex-swap-parser';
import { WSOL } from '../../common/utils';
import { UnknownError } from '../../error';
import Decimal from 'decimal.js';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BANNED_TOKENS } = require('../token/query/clickhouse-query');

/**
 * GeyserSubscriberService — Yellowstone gRPC real-time data feed.
 *
 * Replaces the existing WebSocket-based TransferSubscriberService for
 * account DEX trade notifications, reducing signal latency from 5-30s
 * to < 1s.
 *
 * Architecture:
 * 1. Connects to Yellowstone gRPC endpoint (Helius / QuickNode)
 * 2. Subscribes to all monitored smart money addresses
 * 3. Parses incoming transactions to extract DEX swaps
 * 4. Routes buy signals to AutomaticStrategySyncer (existing flow)
 * 5. Routes sell signals to FollowSellService (new Phase 2 flow)
 */
@Injectable()
export class GeyserSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GeyserSubscriberService.name);
  private client: InstanceType<typeof Client> | null = null;
  private stream: any = null;
  private isRunning = true;
  private monitorAddresses = new Set<string>();
  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 30000; // 30s max backoff

  constructor(
    private readonly configService: ConfigService,
    private readonly automaticStrategySyncer: AutomaticStrategySyncerService,
    private readonly tokenService: TokenService,
    private readonly followSellService: FollowSellService,
    private readonly burstWalletDetector: BurstWalletDetectorService,
    private readonly realtimeExitLiquidity: RealtimeExitLiquidityService,
    private readonly shredStreamPrefetch: ShredStreamPrefetchService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Endpoint selection supports any Yellowstone-compatible gRPC provider:
    //   - GEYSER_GRPC_ENDPOINT         Self-hosted Yellowstone (advanced)
    //   - LASERSTREAM_GRPC_ENDPOINT    Helius LaserStream (drop-in Yellowstone replacement,
    //                                  24h replay, multi-region)
    // If both are set, LaserStream takes precedence because Helius' 2026 benchmarks
    // consistently show lower p99 latency vs self-hosted Yellowstone on shared hardware.
    const endpoint =
      this.configService.get<string>('LASERSTREAM_GRPC_ENDPOINT') ||
      this.configService.get<string>('GEYSER_GRPC_ENDPOINT');
    if (!endpoint) {
      this.logger.warn(
        'No gRPC endpoint configured — set LASERSTREAM_GRPC_ENDPOINT (recommended) ' +
          'or GEYSER_GRPC_ENDPOINT to enable real-time signal capture. ' +
          'Falling back to WebSocket data center.',
      );
      return;
    }

    // Probe the Solana cluster once so we know which validator client (Agave vs
    // Firedancer) we're talking to. Some 2026-era Firedancer-specific optimizations
    // (different shred broadcast timing, epoch-scoped slot metadata) can be gated
    // behind this flag without breaking Agave compatibility.
    await this.probeClusterClientVersion();

    // Wait for strategies to initialize first
    await this.waitForStrategies();
    this.refreshMonitorAddresses();
    this.connectAndSubscribe();
  }

  /**
   * Detect cluster client (Agave / Firedancer / other) to allow future code paths
   * to adapt to protocol differences. Stored on the service so downstream code
   * can branch if needed (e.g., parser adjustments for Firedancer shred layout).
   */
  private clusterClient: 'agave' | 'firedancer' | 'unknown' = 'unknown';
  private async probeClusterClientVersion(): Promise<void> {
    const rpcUrl = this.configService.get<string>('SOLANA_RPC_URL');
    if (!rpcUrl) return;
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getVersion', params: [] }),
        signal: AbortSignal.timeout(3000),
      });
      const data = (await resp.json()) as any;
      const featureSet = data?.result?.['feature-set'];
      const rpcVersion: string = data?.result?.['solana-core'] || '';
      // Firedancer (Frankendancer transitional) advertises 'firedancer' in the
      // `solana-core` string per their release notes; Agave advertises 'agave'.
      const lower = rpcVersion.toLowerCase();
      if (lower.includes('firedancer') || lower.includes('frankendancer')) {
        this.clusterClient = 'firedancer';
      } else if (lower.includes('agave') || /^\d/.test(rpcVersion)) {
        this.clusterClient = 'agave';
      }
      this.logger.log(
        `Cluster client detected: ${this.clusterClient} (core=${rpcVersion}, feature-set=${featureSet})`,
      );
    } catch (err) {
      this.logger.warn(`Cluster client probe failed, defaulting to agave-compat: ${(err as Error)}`);
      this.clusterClient = 'agave';
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;
    this.closeStream();
    this.logger.log('GeyserSubscriberService destroyed');
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Dynamically add new monitor addresses to the subscription.
   * Called when strategies are created/updated.
   */
  addMonitorAddresses(addresses: string[]): void {
    let changed = false;
    for (const addr of addresses) {
      if (!this.monitorAddresses.has(addr)) {
        this.monitorAddresses.add(addr);
        changed = true;
      }
    }
    if (changed) {
      this.logger.log(
        `Monitor addresses updated: ${this.monitorAddresses.size} total`,
      );
      // Reconnect with updated subscription
      this.reconnect();

      // Immediately sync dynamic wallets into strategy executors
      // so they can participate in trade triggers right away
      this.automaticStrategySyncer.syncDynamicSmartWallets().catch((err) => {
        this.logger.error(`Failed to sync dynamic wallets to executors: ${(err as Error)}`);
      });
    }
  }

  /**
   * Refresh monitor addresses from strategy syncer.
   */
  refreshMonitorAddresses(): void {
    const addresses = this.automaticStrategySyncer.monitorAddresses();
    this.monitorAddresses = new Set(addresses);
    // Keep ShredStream prefetch service in sync for pre-confirmation data warming
    this.shredStreamPrefetch.updateMonitorAddresses(this.monitorAddresses);
    this.logger.log(
      `Loaded ${this.monitorAddresses.size} monitor addresses from strategies`,
    );
  }

  // ── Connection Management ───────────────────────────────────────────

  private async waitForStrategies(): Promise<void> {
    // Give strategies time to initialize
    let attempts = 0;
    while (attempts < 30) {
      try {
        const addresses = this.automaticStrategySyncer.monitorAddresses();
        if (addresses.length > 0) return;
      } catch {
        // Strategy syncer not ready yet
      }
      await this.sleep(2000);
      attempts++;
    }
    this.logger.warn('Strategies did not initialize within 60s, continuing anyway');
  }

  private async connectAndSubscribe(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.createConnection();
        await this.subscribe();
        await this.processStream();
      } catch (err) {
        this.logger.error(`gRPC stream error: ${(err as Error)}`);
        this.closeStream();

        if (!this.isRunning) break;

        // Exponential backoff with jitter
        const delay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
          this.maxReconnectDelay,
        );
        this.reconnectAttempts++;
        this.logger.log(
          `Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`,
        );
        await this.sleep(delay);
      }
    }
  }

  private async createConnection(): Promise<void> {
    // Same precedence as onModuleInit — LaserStream wins over self-hosted Yellowstone.
    // Token lookup mirrors the endpoint: LASERSTREAM_GRPC_TOKEN before GEYSER_GRPC_TOKEN.
    const laserEndpoint = this.configService.get<string>('LASERSTREAM_GRPC_ENDPOINT');
    const endpoint = laserEndpoint || this.configService.getOrThrow<string>('GEYSER_GRPC_ENDPOINT');
    const token = laserEndpoint
      ? this.configService.get<string>('LASERSTREAM_GRPC_TOKEN', '')
      : this.configService.get<string>('GEYSER_GRPC_TOKEN', '');
    const provider = laserEndpoint ? 'Helius LaserStream' : 'Yellowstone gRPC';

    this.logger.log(`Connecting to ${provider}: ${endpoint}`);

    this.client = new Client(endpoint, token || undefined, undefined);
    this.stream = await this.client.subscribe();

    this.reconnectAttempts = 0;
    this.logger.log(`${provider} connection established`);
  }

  private async subscribe(): Promise<void> {
    if (!this.stream) throw new Error('Stream not initialized');

    const addresses = Array.from(this.monitorAddresses);
    if (addresses.length === 0) {
      this.logger.warn('No monitor addresses to subscribe to');
      return;
    }

    const request: SubscribeRequest = {
      transactions: {
        smartMoney: {
          accountInclude: addresses,
          accountExclude: [],
          accountRequired: [],
          vote: false,
          failed: false,
        },
      },
      commitment: CommitmentLevel.CONFIRMED,
      accounts: {},
      slots: {},
      transactionsStatus: {},
      blocks: {},
      blocksMeta: {},
      entry: {},
      accountsDataSlice: [],
      ping: { id: 1 },
    };

    await new Promise<void>((resolve, reject) => {
      this.stream.write(request, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.logger.log(
      `Subscribed to ${addresses.length} smart money addresses via gRPC`,
    );
  }

  private async processStream(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.stream) return reject(new Error('No stream'));

      // Periodic ping to keep connection alive. Declared first so handlers can clear it.
      const pingInterval = setInterval(() => {
        if (!this.isRunning || !this.stream) {
          clearInterval(pingInterval);
          return;
        }
        try {
          this.stream.write(
            { ping: { id: Date.now() } } as SubscribeRequest,
            (err: any) => {
              if (err) {
                this.logger.error(`Ping failed: ${(err as Error)}`);
                clearInterval(pingInterval);
              }
            },
          );
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000); // Ping every 15s

      this.stream.on('data', async (update: SubscribeUpdate) => {
        try {
          await this.handleUpdate(update);
        } catch (err) {
          this.logger.error(`Error handling update: ${(err as Error)}`);
        }
      });

      this.stream.on('error', (err: any) => {
        this.logger.error(`gRPC stream error event: ${(err as Error)}`);
        clearInterval(pingInterval);
        reject(err);
      });

      this.stream.on('end', () => {
        this.logger.warn('gRPC stream ended');
        clearInterval(pingInterval);
        resolve();
      });
    });
  }

  // ── Message Handling ────────────────────────────────────────────────

  private async handleUpdate(update: SubscribeUpdate): Promise<void> {
    // Handle pong
    if (update.pong) return;

    // Handle transaction updates
    if (update.transaction) {
      await this.handleTransaction(update.transaction);
    }
  }

  private async handleTransaction(txUpdate: any): Promise<void> {
    // 1) Parse monitored-address swaps for the main trading pipeline
    const monitoredSwaps = parseTransaction(txUpdate, this.monitorAddresses);

    // 2) Parse ALL signer swaps for burst wallet detection (unknown address discovery)
    const allSignerSwaps = parseTransaction(txUpdate, this.monitorAddresses, true);
    for (const swap of allSignerSwaps) {
      if (!BANNED_TOKENS.includes(swap.base_mint)) {
        const isMonitored = this.monitorAddresses.has(swap.trader);
        this.burstWalletDetector.onSwapDetected(swap, isMonitored);
      }
    }

    // Process monitored address swaps through the existing pipeline
    // Deduplicate: skip buy swaps already processed via ShredStream pre-confirmation.
    // Sell swaps always go through (needed for FollowSell and Circuit Breaker).
    const filteredSwaps = monitoredSwaps.filter((swap) => {
      if (BANNED_TOKENS.includes(swap.base_mint)) return false;
      if (swap.side === 'buy' && this.shredStreamPrefetch.wasPreConfirmed(swap.tx_id)) {
        this.logger.debug(
          `Skipping confirmed buy ${swap.tx_id.slice(0, 12)}... — already processed via ShredStream`,
        );
        return false;
      }
      return true;
    });
    if (filteredSwaps.length === 0) return;

    this.logger.log(
      `Parsed ${filteredSwaps.length} swap(s) from tx ${filteredSwaps[0].tx_id}: ` +
        filteredSwaps
          .map((s) => `${s.side} ${s.base_mint.slice(0, 8)}... via ${s.dex}`)
          .join(', '),
    );

    // Separate buy and sell signals
    const buySwaps = filteredSwaps.filter((s) => s.side === 'buy');
    const sellSwaps = filteredSwaps.filter((s) => s.side === 'sell');

    // Process buy signals through existing strategy syncer
    if (buySwaps.length > 0) {
      await this.processBuySignals(buySwaps);
      // Track smart money holdings for follow-sell ratio calculation
      // and register buys for circuit breaker pattern matching
      for (const swap of buySwaps) {
        await this.followSellService.onSmartMoneyBuy(swap);
        await this.realtimeExitLiquidity.onOurBuyExecuted(
          swap.base_mint,
          swap.trader,
        );
      }
    }

    // Process sell signals through follow-sell service + circuit breaker
    if (sellSwaps.length > 0) {
      await this.processSellSignals(sellSwaps);

      // Real-time exit liquidity check: did they dump right after we copied?
      for (const swap of sellSwaps) {
        await this.realtimeExitLiquidity.onSmartMoneySell(swap);
      }
    }
  }

  /**
   * Route buy swaps to the existing AutomaticStrategySyncer flow.
   * Enriches with token prices/info to match the existing interface.
   */
  private async processBuySignals(swaps: ParsedDexSwap[]): Promise<void> {
    try {
      const tokens = Array.from(
        new Set(swaps.map((s) => s.base_mint)),
      );

      const [tokenPrices, tokenInfos, solTokenPrice] = await Promise.all([
        this.tokenService._tokenPrices(tokens),
        this.tokenService.findByMintAddresses(tokens),
        this.tokenService._tokenPrices([WSOL]),
      ]);

      const solPrice = solTokenPrice[0];
      if (!solPrice) {
        throw new UnknownError('Cannot get SOL price');
      }

      const tokenPricesMap = new Map(
        tokenPrices.map((price: any) => [price.baseMint, price]),
      );
      const tokenInfosMap = new Map(
        tokenInfos.map((info: any) => [info.mintAddress, info]),
      );

      // Convert ParsedDexSwap to AccountDexTrade format for compatibility.
      // The parser outputs usd_value='0' — enrich using two strategies:
      //   Primary:  quote_amount (SOL lamports from balance diff) × SOL price
      //   Fallback: token price × base_amount / 10^decimals
      // Primary is ~0ms (no I/O), fallback uses ClickHouse price data.
      const accountDexTrades = swaps.map((swap) => {
        let usdValue = swap.usd_value;
        if (!usdValue || usdValue === '0') {
          // Primary: compute from quote_amount (SOL lamports) when quote is SOL/USDC
          const quoteAmt = new Decimal(swap.quote_amount || '0').abs();
          if (quoteAmt.gt(0)) {
            if (swap.quote_mint === WSOL || swap.quote_mint === 'So11111111111111111111111111111111111111112') {
              // quote is SOL → usd = (lamports / 10^9) × solPrice
              usdValue = quoteAmt.div(1e9).mul(solPrice.latestPrice).toFixed(2);
            } else if (
              swap.quote_mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
              swap.quote_mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'    // USDT
            ) {
              // quote is stablecoin → usd = amount / 10^6
              usdValue = quoteAmt.div(1e6).toFixed(2);
            }
          }
          // Fallback: if quote_amount path didn't work, use token price from ClickHouse
          if (!usdValue || usdValue === '0') {
            const priceInfo = tokenPricesMap.get(swap.base_mint) as any;
            if (priceInfo?.latestPrice) {
              const tokenInfo = tokenInfosMap.get(swap.base_mint) as any;
              const decimals = tokenInfo?.decimals ?? 9;
              const normalizedAmount = new Decimal(swap.base_amount)
                .div(new Decimal(10).pow(decimals))
                .abs();
              usdValue = normalizedAmount.mul(priceInfo.latestPrice).toFixed(2);
            }
          }
        }
        return {
          tx_id: swap.tx_id,
          trader: swap.trader,
          base_mint: swap.base_mint,
          quote_mint: swap.quote_mint,
          block_time: swap.block_time,
          base_amount: swap.base_amount,
          quote_amount: swap.quote_amount,
          usd_value: usdValue,
        };
      });

      this.automaticStrategySyncer.syncAccountDexTrades(
        accountDexTrades,
        tokenPricesMap,
        tokenInfosMap,
        solPrice.latestPrice,
      );
    } catch (err) {
      this.logger.error(`Failed to process buy signals: ${(err as Error)}`);
    }
  }

  /**
   * Route sell swaps to the FollowSellService for follow-sell logic.
   */
  private async processSellSignals(swaps: ParsedDexSwap[]): Promise<void> {
    try {
      for (const swap of swaps) {
        await this.followSellService.onSmartMoneySell(swap);
      }
    } catch (err) {
      this.logger.error(`Failed to process sell signals: ${(err as Error)}`);
    }
  }

  // ── Utilities ───────────────────────────────────────────────────────

  private reconnect(): void {
    if (!this.isRunning) return;
    this.closeStream();
    // connectAndSubscribe loop will automatically reconnect
  }

  private closeStream(): void {
    try {
      if (this.stream) {
        this.stream.end();
        this.stream = null;
      }
    } catch {
      // Ignore close errors
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
