import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  WalletMetrics,
  WalletScore,
  WalletScorerService,
  TradingStyle,
} from '../wallet-scorer/wallet-scorer.service';

export type SmartWalletSourceType =
  | 'gmgn'
  | 'birdeye'
  | 'cielo'
  | 'chainfm'
  | 'manual'
  | 'onchain_discovery';

export type SmartWalletCandidateStatus = 'active' | 'watch' | 'blacklisted';

export interface SmartWalletCandidate {
  address: string;
  chain: 'solana';
  name?: string;
  sourceType: SmartWalletSourceType;
  sourceLabel?: string;
  status: SmartWalletCandidateStatus;
  isSystemMonitored: boolean;
  firstSeenMs: number;
  lastSeenMs: number;
  lastImportedMs?: number;
  /** Number of separate import cycles this wallet has been discovered in */
  importCount: number;
  score?: number;
  tier?: WalletScore['tier'];
  tradingStyle?: TradingStyle;
  metrics?: WalletMetrics;
  notes?: string;
  rawData?: Record<string, any>;
}

export interface ImportWalletCandidateInput {
  address: string;
  name?: string;
  sourceLabel?: string;
  metrics?: Partial<WalletMetrics>;
  rawData?: Record<string, any>;
  notes?: string;
  isSystemMonitored?: boolean;
}

const CANDIDATE_TTL_SECS = 86400 * 45; // 45 days — aligned with 30d scoring window + 15d buffer
const MIN_IMPORT_CYCLES_FOR_ACTIVE = 2; // must be seen in 2+ separate import rounds to become active

/**
 * Seeding discipline constants — prevents low-quality wallets from quickly
 * reaching 'active' status and polluting the smart money pool.
 *
 * Motivation: Solidus Labs 2025 found that 98.6% of pump.fun tokens are rug
 * pulls or pump-and-dumps. A smart money pool seeded with wallets that look
 * profitable only because they co-launched rugs is worse than no smart money.
 */
/** Minimum PnL30d (SOL) for a wallet to auto-qualify. Below this, stays 'watch'. */
const MIN_PNL30D_FOR_ACTIVE = 20; // 20 SOL profit in 30 days
/** Minimum unique tokens traded in 30d — guards against single-token wash trades */
const MIN_DISTINCT_TOKENS_FOR_ACTIVE = 5;
/** Maximum rug pull count allowed for an active candidate (hard cap) */
const MAX_RUGPULL_COUNT_FOR_ACTIVE = 2;

@Injectable()
export class SmartWalletSourceService implements OnModuleInit {
  private readonly logger = new Logger(SmartWalletSourceService.name);
  private readonly cachePrefix: string;
  private readonly candidates = new Map<string, SmartWalletCandidate>();

  /** Callback invoked when new active S/A wallets are added, for live sync to trading executors */
  private onActiveWalletsChanged?: (addresses: string[]) => void;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
    @Optional() private readonly walletScorerService?: WalletScorerService,
  ) {
    const env = this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase();
    this.cachePrefix = `${env}:DEXAUTO:SMART_WALLET_SOURCE:`;
  }

  /**
   * Register a callback to be notified when new active S/A wallets are added.
   * Used by AutomaticStrategySyncerService to immediately inject dynamic wallets
   * into strategy executors without waiting for the 5-min cron.
   */
  registerActiveWalletsChangedCallback(cb: (addresses: string[]) => void): void {
    this.onActiveWalletsChanged = cb;
  }

  async onModuleInit(): Promise<void> {
    await this.loadCandidatesFromCache();
    this.logger.log(`Loaded ${this.candidates.size} smart wallet candidates from cache`);
  }

  async importCandidates(
    sourceType: SmartWalletSourceType,
    items: ImportWalletCandidateInput[],
  ): Promise<SmartWalletCandidate[]> {
    const results: SmartWalletCandidate[] = [];
    let skipped = 0;
    for (const item of items) {
      const address = item.address?.trim();
      if (!address || !this.isValidSolanaAddress(address)) {
        skipped++;
        continue;
      }
      const candidate = await this.upsertCandidate(sourceType, address, item);
      results.push(candidate);
    }
    if (skipped > 0) {
      this.logger.warn(`Skipped ${skipped} invalid addresses from source ${sourceType}`);
    }
    this.logger.log(`Imported ${results.length} candidates from source ${sourceType}`);

    // Notify listeners about newly activated S/A wallets
    if (this.onActiveWalletsChanged) {
      const newActive = results.filter(
        (c) => c.status === 'active' && (c.tier === 'S' || c.tier === 'A'),
      );
      if (newActive.length > 0) {
        this.onActiveWalletsChanged(newActive.map((c) => c.address));
      }
    }

    return results;
  }

  private isValidSolanaAddress(address: string): boolean {
    // Solana addresses are base58-encoded, 32-44 characters
    if (address.length < 32 || address.length > 44) return false;
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
  }

  async blacklistAddress(address: string, notes?: string): Promise<void> {
    const existing = this.candidates.get(address);
    const now = Date.now();
    const candidate: SmartWalletCandidate = {
      address,
      chain: 'solana',
      sourceType: existing?.sourceType ?? 'manual',
      sourceLabel: existing?.sourceLabel,
      name: existing?.name,
      firstSeenMs: existing?.firstSeenMs ?? now,
      lastSeenMs: now,
      status: 'blacklisted',
      isSystemMonitored: false,
      importCount: existing?.importCount ?? 1,
      score: existing?.score,
      tier: existing?.tier,
      metrics: existing?.metrics,
      notes: notes ?? existing?.notes,
      rawData: existing?.rawData,
      lastImportedMs: now,
    };
    this.candidates.set(address, candidate);
    await this.persistCandidate(candidate);
  }

  getCandidate(address: string): SmartWalletCandidate | undefined {
    return this.candidates.get(address);
  }

  getAllCandidates(): SmartWalletCandidate[] {
    return Array.from(this.candidates.values()).sort((a, b) => b.lastSeenMs - a.lastSeenMs);
  }

  getActiveCandidates(): SmartWalletCandidate[] {
    return this.getAllCandidates().filter((candidate) => candidate.status !== 'blacklisted');
  }

  getSystemMonitorAddresses(): string[] {
    return this.getAllCandidates()
      .filter(
        (candidate) =>
          candidate.status === 'active' &&
          candidate.isSystemMonitored &&
          (candidate.tier === 'S' || candidate.tier === 'A'),
      )
      .map((candidate) => candidate.address);
  }

  async rescoreCandidate(address: string, metrics: WalletMetrics): Promise<SmartWalletCandidate | undefined> {
    const existing = this.candidates.get(address);
    if (!existing) {
      return undefined;
    }
    const score = await this.scoreWallet(metrics);
    const updated: SmartWalletCandidate = {
      ...existing,
      score: score?.compositeScore,
      tier: score?.tier,
      tradingStyle: score?.tradingStyle,
      metrics,
      status: this.toStatus(score, existing.importCount, existing.sourceType, existing.rawData),
      lastSeenMs: Date.now(),
    };
    this.candidates.set(address, updated);
    await this.persistCandidate(updated);
    return updated;
  }

  private async upsertCandidate(
    sourceType: SmartWalletSourceType,
    address: string,
    item: ImportWalletCandidateInput,
  ): Promise<SmartWalletCandidate> {
    const existing = this.candidates.get(address);
    const now = Date.now();
    const metrics = this.buildMetrics(address, item.metrics);
    const score = await this.scoreWallet(metrics);

    // Count separate import cycles: increment only if last import was >1h ago
    const isNewCycle =
      !existing?.lastImportedMs ||
      now - existing.lastImportedMs > 3600_000;
    const importCount = (existing?.importCount ?? 0) + (isNewCycle ? 1 : 0);

    // Preserve original sourceType if already known — prevents bypassing
    // cross-cycle confirmation by re-importing from a trusted source
    const effectiveSourceType = existing?.sourceType ?? sourceType;

    const mergedRawData = {
      ...(existing?.rawData ?? {}),
      ...(item.rawData ?? {}),
    };
    const candidate: SmartWalletCandidate = {
      address,
      chain: 'solana',
      name: item.name ?? existing?.name,
      sourceType: effectiveSourceType,
      sourceLabel: item.sourceLabel ?? existing?.sourceLabel,
      status: this.toStatus(score, importCount, effectiveSourceType, mergedRawData),
      isSystemMonitored: item.isSystemMonitored ?? existing?.isSystemMonitored ?? true,
      firstSeenMs: existing?.firstSeenMs ?? now,
      lastSeenMs: now,
      lastImportedMs: now,
      importCount,
      score: score?.compositeScore,
      tier: score?.tier,
      tradingStyle: score?.tradingStyle,
      metrics,
      notes: item.notes ?? existing?.notes,
      rawData: mergedRawData,
    };
    this.candidates.set(address, candidate);
    await this.persistCandidate(candidate);
    return candidate;
  }

  private buildMetrics(address: string, metrics?: Partial<WalletMetrics>): WalletMetrics {
    // Conservative defaults: unknown wallets should NOT auto-qualify as B-tier.
    // pnl30d=0, winRate30d=0.3 (below 0.4 threshold), tradeCount30d=0 → low score by default.
    return {
      address,
      pnl30d: metrics?.pnl30d ?? 0,
      winRate30d: metrics?.winRate30d ?? 0.3,
      avgHoldTime: metrics?.avgHoldTime ?? 300,
      tradeCount30d: metrics?.tradeCount30d ?? 0,
      avgPositionSize: metrics?.avgPositionSize ?? 0,
      recentAvgPositionSize: metrics?.recentAvgPositionSize,
      maxDrawdown: metrics?.maxDrawdown ?? 0.5,
      rugPullCount: metrics?.rugPullCount ?? 0,
      bundleCount: metrics?.bundleCount ?? 0,
      unsafeTokenRatio: metrics?.unsafeTokenRatio,
    };
  }

  private async scoreWallet(metrics: WalletMetrics): Promise<WalletScore | undefined> {
    if (!this.walletScorerService) {
      return undefined;
    }
    return this.walletScorerService.scoreWallet(metrics);
  }

  private toStatus(
    score?: WalletScore,
    importCount?: number,
    sourceType?: SmartWalletSourceType,
    rawData?: Record<string, any>,
  ): SmartWalletCandidateStatus {
    if (!score) {
      return 'watch';
    }
    if (score.tier === 'C') {
      return 'blacklisted';
    }

    // ── Hard seeding-discipline guards (applied BEFORE tier-based activation) ──
    //   1. Wallet must have real PnL30d >= MIN_PNL30D_FOR_ACTIVE
    //   2. Wallet must trade >= MIN_DISTINCT_TOKENS_FOR_ACTIVE unique tokens
    //   3. Wallet's rugPullCount must be <= MAX_RUGPULL_COUNT_FOR_ACTIVE
    // These guards close the "single-token pump co-launcher" loophole where a
    // wallet looks top-tier because it helped pump ONE coin with concentrated
    // liquidity extraction, then never traded again.
    const m = score.metrics;
    if (m.pnl30d < MIN_PNL30D_FOR_ACTIVE) {
      return 'watch';
    }
    if (m.rugPullCount > MAX_RUGPULL_COUNT_FOR_ACTIVE) {
      return 'blacklisted';
    }
    // Distinct token count isn't directly in WalletMetrics — check rawData if upstream
    // discovery pipeline provides it (burst detector injects `uniqueTokensTraded`).
    const uniqueTokens = rawData?.uniqueTokensTraded;
    if (typeof uniqueTokens === 'number' && uniqueTokens < MIN_DISTINCT_TOKENS_FOR_ACTIVE) {
      return 'watch';
    }

    if (score.tier === 'S' || score.tier === 'A') {
      // Onchain discovery and manual sources are pre-validated — skip cycle check
      if (sourceType === 'onchain_discovery' || sourceType === 'manual') {
        return 'active';
      }
      // External API sources (gmgn/birdeye/cielo/chainfm): require cross-cycle confirmation
      if ((importCount ?? 0) >= MIN_IMPORT_CYCLES_FOR_ACTIVE) {
        return 'active';
      }
      return 'watch';
    }
    return 'watch';
  }

  private async persistCandidate(candidate: SmartWalletCandidate): Promise<void> {
    await this.redisClient.setex(
      this.candidateKey(candidate.address),
      CANDIDATE_TTL_SECS,
      JSON.stringify(candidate),
    );
  }

  private async loadCandidatesFromCache(): Promise<void> {
    const pattern = `${this.cachePrefix}CANDIDATE:*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redisClient.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      for (const key of keys) {
        const raw = await this.redisClient.get(key);
        if (!raw) {
          continue;
        }
        try {
          const candidate = JSON.parse(raw) as SmartWalletCandidate;
          this.candidates.set(candidate.address, candidate);
        } catch {
        }
      }
    } while (cursor !== '0');
  }

  private candidateKey(address: string): string {
    return `${this.cachePrefix}CANDIDATE:${address}`;
  }
}
