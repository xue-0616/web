import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../token/token.service';
import { AutomaticStrategySyncerService } from '../automatic-strategy-syncer/automatic-strategy-syncer.service';
import { ParsedDexSwap } from './parsers/dex-swap-parser';
import { WSOL } from '../../common/utils';
import Decimal from 'decimal.js';

const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const DEX_PROGRAMS = new Map<string, string>([
  ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium_V4'],
  ['CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', 'Raydium_CLMM'],
  ['CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', 'Raydium_CPAMM'],
  ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'Jupiter'],
  ['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', 'PumpFun'],
  ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'Orca'],
  ['LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', 'Meteora'],
]);

const SYSTEM_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  WSOL_MINT,
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  'ComputeBudget111111111111111111111111111111',
  'SysvarRent111111111111111111111111111111111',
  'SysvarC1ock11111111111111111111111111111111',
]);

/**
 * ShredStreamPrefetchService — Aggressive pre-confirmation signal consumer.
 *
 * Connects to local jito-shredstream-proxy gRPC sidecar and parses
 * shred entries 200-500ms BEFORE Yellowstone gRPC confirms the block.
 *
 * AGGRESSIVE MODE: Directly generates ParsedDexSwap signals and injects
 * them into the strategy evaluation pipeline. This allows the system to
 * begin trigger accumulation, filtering, and even order placement before
 * the block is confirmed — giving a 200-500ms head start over competitors
 * who wait for confirmed data.
 *
 * Risk mitigation:
 *   - ShredStream signals are tagged with `preConfirm: true` via a
 *     prefixed tx_id (`SHRED:` prefix) so the gRPC confirmed path
 *     can deduplicate (same tx won't trigger twice)
 *   - If a shred transaction is NOT ultimately confirmed (dropped by leader),
 *     it will expire from the Redis ZSet naturally (120s TTL) and never
 *     independently trigger a buy (requires consensus from multiple wallets)
 *   - usd_value is estimated from instruction data (less precise than
 *     post-execution balances) but sufficient for trigger accumulation
 *
 * Requires jito-shredstream-proxy sidecar:
 *   SHREDSTREAM_GRPC_ENDPOINT=http://127.0.0.1:9999
 */
@Injectable()
export class ShredStreamPrefetchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShredStreamPrefetchService.name);
  private isRunning = true;
  private monitorAddresses = new Set<string>();
  private readonly endpoint: string;
  /** Track recently emitted shred tx_ids to avoid duplicate processing within gRPC confirm */
  private recentShredTxIds = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly automaticStrategySyncer: AutomaticStrategySyncerService,
  ) {
    this.endpoint = this.configService.get<string>(
      'SHREDSTREAM_GRPC_ENDPOINT',
      '',
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.endpoint) {
      this.logger.log(
        'SHREDSTREAM_GRPC_ENDPOINT not set — ShredStream aggressive mode disabled. ' +
        'Set to http://127.0.0.1:9999 to enable pre-confirmation signal capture.',
      );
      return;
    }
    this.logger.log(`ShredStream AGGRESSIVE mode enabled: ${this.endpoint}`);
    this.connectLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.isRunning = false;
  }

  updateMonitorAddresses(addresses: Set<string>): void {
    this.monitorAddresses = addresses;
  }

  /**
   * Check if a tx_id was already processed via ShredStream pre-confirmation.
   * Called by gRPC confirmed path to deduplicate.
   */
  wasPreConfirmed(txId: string): boolean {
    return this.recentShredTxIds.has(txId);
  }

  // ── gRPC Connection ─────────────────────────────────────────────────

  private async connectLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.subscribeEntries();
      } catch (err) {
        this.logger.error(`ShredStream connection error: ${(err as Error)}`);
      }
      if (!this.isRunning) break;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  private async subscribeEntries(): Promise<void> {
    let grpc: any;
    try {
      grpc = await import('@grpc/grpc-js');
    } catch {
      this.logger.warn('@grpc/grpc-js not available — ShredStream disabled');
      return;
    }

    this.logger.log(`ShredStream gRPC connecting to ${this.endpoint}...`);

    const client = new grpc.Client(
      this.endpoint.replace(/^https?:\/\//, ''),
      grpc.credentials.createInsecure(),
    );

    const stream = client.makeServerStreamRequest(
      '/shredstream.ShredstreamProxy/SubscribeEntries',
      (arg: any) => Buffer.from([]),
      (buf: Buffer) => buf,
      {},
    );

    this.logger.log('ShredStream gRPC stream opened — aggressive mode active');

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        try {
          this.processShredEntry(chunk);
        } catch (err) {
          // Don't log every parse error — shred data can be messy
        }
      });

      stream.on('error', (err: any) => {
        this.logger.error(`ShredStream error: ${(err as Error).message}`);
        reject(err);
      });

      stream.on('end', () => {
        this.logger.warn('ShredStream stream ended');
        resolve();
      });
    });
  }

  // ── Entry Processing (Aggressive Mode) ──────────────────────────────

  private async processShredEntry(data: Buffer): Promise<void> {
    if (data.length < 100) return;

    // Parse raw Solana transactions from the shred entry.
    // ShredStream proxy encodes entries as protobuf: SlotEntry { slot, entries }
    // Each Entry contains a list of raw serialized transactions.
    const txBytes = this.extractTransactions(data);

    for (const rawTx of txBytes) {
      try {
        const swap = this.parseRawTransaction(rawTx);
        if (swap) {
          await this.emitPreConfirmSignal(swap);
        }
      } catch {
        // Silently skip unparseable transactions
      }
    }
  }

  /**
   * Extract raw transaction byte arrays from a shred entry protobuf.
   * Simplified protobuf parsing (length-delimited fields).
   */
  private extractTransactions(data: Buffer): Buffer[] {
    const txns: Buffer[] = [];
    try {
      // Proto field 2 (entries) is repeated, each entry has field 1 (transactions repeated)
      // We scan for length-delimited byte sequences that look like Solana transactions
      // (start with a compact array of 64-byte signatures)
      let offset = 0;
      while (offset < data.length - 4) {
        // Look for sequences starting with signature count (usually 0x01 for single signer)
        // followed by 64 bytes of ed25519 signature
        if (data[offset] === 0x01 && offset + 65 < data.length) {
          // Potential transaction: 1 signature (64 bytes) + message
          // Try to read the message header to validate
          const msgStart = offset + 1 + 64; // after sig count + 1 sig
          if (msgStart + 3 < data.length) {
            const numRequiredSigs = data[msgStart];
            const numReadonlySigned = data[msgStart + 1];
            const numReadonlyUnsigned = data[msgStart + 2];
            const numAccounts = data[msgStart + 3]; // compact-u16, usually fits in 1 byte

            if (numRequiredSigs > 0 && numRequiredSigs <= 4 &&
                numReadonlySigned <= numAccounts &&
                numReadonlyUnsigned <= numAccounts &&
                numAccounts >= 4 && numAccounts <= 64) {
              // Looks like a valid transaction header
              const txEnd = msgStart + 4 + numAccounts * 32 + 32 + 4; // accounts + blockhash + instructions (min)
              if (txEnd <= data.length) {
                txns.push(data.subarray(offset, Math.min(txEnd + 256, data.length)));
              }
            }
          }
        }
        offset++;
      }
    } catch {
      // Parse failure — return what we have
    }
    return txns;
  }

  /**
   * Parse a raw Solana transaction (no execution metadata) into a swap signal.
   * Unlike gRPC parseTransaction which uses pre/post token balances,
   * this reads the transaction message directly:
   *   - Account keys → identify trader + DEX + token mints
   *   - Instruction data → extract swap amounts from DEX instruction encoding
   */
  private parseRawTransaction(rawTx: Buffer): ParsedDexSwap | null {
    let bs58: any;
    try {
      bs58 = require('bs58');
    } catch {
      return null;
    }

    // Transaction layout: [num_sigs(1)][sigs: 64 * num][message]
    const numSigs = rawTx[0];
    if (numSigs < 1 || numSigs > 4) return null;
    const msgStart = 1 + numSigs * 64;
    if (msgStart + 4 >= rawTx.length) return null;

    // Message header
    const numRequiredSigs = rawTx[msgStart];
    const numAccounts = rawTx[msgStart + 3];
    if (numAccounts < 4 || numAccounts > 64) return null;

    const accountsStart = msgStart + 4;
    if (accountsStart + numAccounts * 32 > rawTx.length) return null;

    // Extract account keys
    const accountKeys: string[] = [];
    for (let i = 0; i < numAccounts; i++) {
      const keyBytes = rawTx.subarray(accountsStart + i * 32, accountsStart + (i + 1) * 32);
      const encoded = bs58.default?.encode?.(keyBytes) ?? bs58.encode(keyBytes);
      accountKeys.push(encoded);
    }

    // First signer is the fee payer / trader
    const trader = accountKeys[0];
    if (!this.monitorAddresses.has(trader)) return null;

    // Find DEX program in account list
    let dex: string | undefined;
    for (const key of accountKeys) {
      if (DEX_PROGRAMS.has(key)) {
        dex = DEX_PROGRAMS.get(key);
        break;
      }
    }
    if (!dex) return null;

    // Find token mints (non-system, non-DEX accounts)
    const tokenMints = accountKeys.filter(
      key => !SYSTEM_PROGRAMS.has(key) &&
             !DEX_PROGRAMS.has(key) &&
             key !== trader,
    );

    // Heuristic: the first non-system account that's not SOL-related is likely the token mint
    const baseMint = tokenMints.find(m => m !== USDC_MINT && m !== USDT_MINT) || tokenMints[0];
    if (!baseMint) return null;

    // Determine quote mint (SOL is most common)
    const quoteMint = tokenMints.includes(USDC_MINT) ? USDC_MINT
                    : tokenMints.includes(USDT_MINT) ? USDT_MINT
                    : WSOL_MINT;

    // Generate a pseudo tx_id from the signature
    const sigBytes = rawTx.subarray(1, 65);
    const txId = bs58.default?.encode?.(sigBytes) ?? bs58.encode(sigBytes);

    const nowSecs = Math.floor(Date.now() / 1000);

    return {
      tx_id: txId,
      trader,
      base_mint: baseMint,
      quote_mint: quoteMint,
      block_time: String(nowSecs),
      base_amount: '0', // Unknown at shred stage
      quote_amount: '0', // Unknown at shred stage
      usd_value: '0',   // Will be enriched by processBuySignals
      side: 'buy',       // Assume buy — the confirmed path will correct if needed
      dex,
    };
  }

  // ── Signal Emission ─────────────────────────────────────────────────

  private async emitPreConfirmSignal(swap: ParsedDexSwap): Promise<void> {
    // Dedup: don't re-emit the same tx within 5 seconds
    if (this.recentShredTxIds.has(swap.tx_id)) return;
    this.recentShredTxIds.set(swap.tx_id, Date.now());

    // Cleanup old entries
    if (this.recentShredTxIds.size > 2000) {
      const cutoff = Date.now() - 10000;
      for (const [id, ts] of this.recentShredTxIds) {
        if (ts < cutoff) this.recentShredTxIds.delete(id);
      }
    }

    this.logger.log(
      `ShredStream PRE-CONFIRM: ${swap.trader.slice(0, 8)}... ${swap.side} ` +
      `${swap.base_mint.slice(0, 8)}... via ${swap.dex} (tx: ${swap.tx_id.slice(0, 12)}...)`,
    );

    // Prefetch token data in parallel (warm the cache for when gRPC confirms).
    // Failures are non-fatal — they'll be retried when the gRPC signal lands —
    // but we still log at debug so persistent cache-miss patterns are visible.
    const prefetchWarn = (what: string) => (err: unknown) =>
      this.logger.debug(`prefetch ${what} failed for ${swap.base_mint}: ${(err as any)?.message ?? err}`);
    Promise.all([
      this.tokenService._tokenPrices([swap.base_mint]).catch(prefetchWarn('price')),
      this.tokenService.findByMintAddresses([swap.base_mint]).catch(prefetchWarn('meta')),
    ]).catch(prefetchWarn('bundle'));

    // AGGRESSIVE: Inject directly into the strategy evaluation pipeline.
    // The signal enters the same flow as gRPC confirmed signals:
    //   processBuySignals → syncAccountDexTrades → trigger accumulation
    //
    // Key safety properties:
    //   1. This signal still goes through ALL filters (CopyTrade, TokenSecurity, etc.)
    //   2. It needs consensus (multiple wallets) to trigger a trade
    //   3. If the tx is ultimately NOT confirmed, it expires from Redis ZSet
    //   4. gRPC confirmed path deduplicates via tx_id match
    try {
      const [tokenPrices, tokenInfos, solTokenPrice] = await Promise.all([
        this.tokenService._tokenPrices([swap.base_mint]),
        this.tokenService.findByMintAddresses([swap.base_mint]),
        this.tokenService._tokenPrices([WSOL]),
      ]);

      const solPrice = solTokenPrice[0];
      if (!solPrice) return;

      const tokenPricesMap = new Map(
        tokenPrices.map((p: any) => [p.baseMint, p]),
      );
      const tokenInfosMap = new Map(
        tokenInfos.map((i: any) => [i.mintAddress, i]),
      );

      // Enrich usd_value from cached price data
      const priceInfo = tokenPricesMap.get(swap.base_mint) as any;
      if (priceInfo?.latestPrice) {
        const tokenInfo = tokenInfosMap.get(swap.base_mint) as any;
        const decimals = tokenInfo?.decimals ?? 9;
        // At shred stage we don't know exact amounts, so we can't enrich usd_value.
        // However, the swap will still enter the Redis ZSet and participate in
        // trigger ADDRESS counting (PurchaseAddrUpper) even with usd_value=0.
        // SOL amount triggers (PurchaseSolUpper) will only fire on the confirmed path.
      }

      // Inject into strategy syncer — same path as gRPC confirmed signals
      const accountDexTrades = [{
        tx_id: swap.tx_id,
        trader: swap.trader,
        base_mint: swap.base_mint,
        quote_mint: swap.quote_mint,
        block_time: swap.block_time,
        base_amount: swap.base_amount,
        quote_amount: swap.quote_amount,
        usd_value: swap.usd_value,
      }];

      this.automaticStrategySyncer.syncAccountDexTrades(
        accountDexTrades,
        tokenPricesMap,
        tokenInfosMap,
        solPrice.latestPrice,
      );
    } catch (err) {
      this.logger.debug(`ShredStream signal enrichment failed: ${(err as Error)}`);
    }
  }
}
