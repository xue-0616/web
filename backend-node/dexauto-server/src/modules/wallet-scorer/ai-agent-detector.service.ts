import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { WalletScorerService, WalletMetrics, WalletScore } from './wallet-scorer.service';

// ── Interfaces ────────────────────────────────────────────────────────

/**
 * AI Agent wallet profile — distinct from human smart money.
 *
 * AI Agent trading patterns differ from humans:
 * - Ultra-high frequency (10-100+ trades/day)
 * - Small position sizes (0.01-0.5 SOL each)
 * - Narrative-driven (react to social signals, memes, launches)
 * - Addresses change frequently (agent frameworks redeploy)
 * - Often use specific program IDs (elizaOS, RIG, Virtuals, TAI)
 */
export interface AIAgentProfile {
  address: string;
  /** Which AI agent framework is suspected */
  framework: AIAgentFramework | 'unknown';
  /** Confidence that this is an AI agent (0-1) */
  confidence: number;
  /** Evidence for the classification */
  evidence: string[];
  /** Agent-specific scoring (separate from human wallet scoring) */
  agentScore: number;
  /** Whether this agent's trades have shown alpha */
  hasAlpha: boolean;
  /** 7-day PnL in SOL */
  pnl7d: number;
  /** Trades per day (7-day avg) */
  tradesPerDay: number;
  /** Average position size in SOL */
  avgPositionSol: number;
  /** Last detected activity timestamp */
  lastActiveMs: number;
}

export type AIAgentFramework =
  | 'elizaOS'
  | 'virtuals'
  | 'rig'
  | 'tai'
  | 'arc'
  | 'custom';

export interface AIAgentSignal {
  agentAddress: string;
  framework: AIAgentFramework | 'unknown';
  tokenMint: string;
  side: 'buy' | 'sell';
  solAmount: number;
  timestamp: number;
  /** Overlaps with human smart money consensus for the same token */
  overlapsHumanConsensus: boolean;
}

export interface AIAgentStats {
  totalAgents: number;
  activeAgents: number;
  byFramework: Record<string, number>;
  avgPnl7d: number;
  alphaAgentCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────

const AGENT_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:AI_AGENT:`;
const AGENT_TTL_SECS = 86400 * 14; // 14 days

/**
 * Known program IDs associated with AI agent frameworks on Solana.
 * These are used as heuristics — actual addresses need continuous updating.
 */
const KNOWN_AGENT_PROGRAMS: Record<AIAgentFramework, string[]> = {
  elizaOS: [],   // Populated from registry
  virtuals: [],  // Populated from registry
  rig: [],       // Populated from registry
  tai: [],       // Populated from registry
  arc: [],       // Populated from registry
  custom: [],
};

/** Behavioral thresholds for AI agent detection */
const AGENT_DETECTION = {
  minTradesPerDay: 15,          // Humans rarely trade 15+/day consistently
  maxAvgPositionSol: 0.5,      // Agents use small positions
  minConsistency: 0.8,         // Agents trade consistently (no weekends off)
  maxAvgHoldTimeSecs: 300,     // Agents flip fast (< 5 min avg)
};

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class AIAgentDetectorService {
  private readonly logger = new Logger(AIAgentDetectorService.name);
  private readonly cachePrefix: string;

  /** Known AI agent profiles */
  private agents = new Map<string, AIAgentProfile>();

  /** Recent AI agent signals (independent from human consensus) */
  private recentSignals: AIAgentSignal[] = [];
  private readonly maxSignalHistory = 1000;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly walletScorerService: WalletScorerService,
  ) {
    const env = process.env.NODE_ENV?.toUpperCase() ?? 'DEV';
    this.cachePrefix = AGENT_CACHE_PREFIX(env);
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Check if an address is a known AI agent.
   */
  isAgent(address: string): boolean {
    return this.agents.has(address);
  }

  /**
   * Get agent profile.
   */
  getAgent(address: string): AIAgentProfile | undefined {
    return this.agents.get(address);
  }

  /**
   * Get all known agents.
   */
  getAllAgents(): AIAgentProfile[] {
    return Array.from(this.agents.values());
  }

  /**
   * Detect if a wallet address belongs to an AI agent based on behavioral patterns.
   *
   * Detection signals:
   * 1. Trading frequency (>15/day consistent)
   * 2. Position size (small, uniform amounts)
   * 3. Hold times (very short, automated patterns)
   * 4. No human patterns (trades 24/7, no weekends off)
   * 5. Associated with known agent program IDs
   */
  async detectAgent(
    address: string,
    metrics: WalletMetrics,
    additionalEvidence?: { framework?: AIAgentFramework; programIds?: string[] },
  ): Promise<AIAgentProfile | null> {
    let confidence = 0;
    const evidence: string[] = [];

    // Signal 1: High trading frequency
    const tradesPerDay = metrics.tradeCount30d / 30;
    if (tradesPerDay >= AGENT_DETECTION.minTradesPerDay) {
      confidence += 0.25;
      evidence.push(`High freq: ${tradesPerDay.toFixed(1)} trades/day`);
    }

    // Signal 2: Small uniform positions
    if (metrics.avgPositionSize <= AGENT_DETECTION.maxAvgPositionSol) {
      confidence += 0.2;
      evidence.push(`Small positions: avg ${metrics.avgPositionSize.toFixed(3)} SOL`);
    }

    // Signal 3: Very fast hold times
    if (metrics.avgHoldTime <= AGENT_DETECTION.maxAvgHoldTimeSecs) {
      confidence += 0.2;
      evidence.push(`Fast flip: avg hold ${metrics.avgHoldTime.toFixed(0)}s`);
    }

    // Signal 4: Known framework
    if (additionalEvidence?.framework) {
      confidence += 0.3;
      evidence.push(`Known framework: ${additionalEvidence.framework}`);
    }

    // Signal 5: Program ID match
    if (additionalEvidence?.programIds) {
      for (const [framework, knownIds] of Object.entries(KNOWN_AGENT_PROGRAMS)) {
        const match = additionalEvidence.programIds.some((id) => knownIds.includes(id));
        if (match) {
          confidence += 0.25;
          evidence.push(`Program ID match: ${framework}`);
          break;
        }
      }
    }

    confidence = Math.min(confidence, 1.0);

    // Threshold: need at least 0.5 confidence to classify as agent
    if (confidence < 0.5) return null;

    const profile: AIAgentProfile = {
      address,
      framework: additionalEvidence?.framework ?? 'unknown',
      confidence,
      evidence,
      agentScore: this.calculateAgentScore(metrics),
      hasAlpha: metrics.pnl30d > 0 && metrics.winRate30d > 0.4,
      pnl7d: metrics.pnl30d / 4, // Approximate 7d from 30d
      tradesPerDay,
      avgPositionSol: metrics.avgPositionSize,
      lastActiveMs: Date.now(),
    };

    this.agents.set(address, profile);
    await this.persistAgent(profile);

    this.logger.log(
      `AI Agent detected: ${address.slice(0, 8)}... ` +
      `(${profile.framework}, confidence=${confidence.toFixed(2)}, alpha=${profile.hasAlpha})`,
    );

    return profile;
  }

  /**
   * Record an AI agent's trade signal.
   * Kept separate from human smart money consensus.
   */
  recordSignal(signal: AIAgentSignal): void {
    this.recentSignals.push(signal);
    if (this.recentSignals.length > this.maxSignalHistory) {
      this.recentSignals = this.recentSignals.slice(-this.maxSignalHistory);
    }
  }

  /**
   * Check if AI agent signals overlap with human consensus for a token.
   * When both AI and human smart money agree, signal confidence is higher.
   */
  getAgentSignalsForToken(tokenMint: string, withinMs = 60000): AIAgentSignal[] {
    const cutoff = Date.now() - withinMs;
    return this.recentSignals.filter(
      (s) => s.tokenMint === tokenMint && s.timestamp >= cutoff,
    );
  }

  /**
   * Get AI agent statistics for dashboard.
   */
  getStats(): AIAgentStats {
    const agents = Array.from(this.agents.values());
    const now = Date.now();
    const activeThreshold = 7 * 86400 * 1000; // 7 days

    const byFramework: Record<string, number> = {};
    let totalPnl = 0;
    let activeCount = 0;
    let alphaCount = 0;

    for (const agent of agents) {
      const fw = agent.framework;
      byFramework[fw] = (byFramework[fw] ?? 0) + 1;
      totalPnl += agent.pnl7d;
      if (now - agent.lastActiveMs < activeThreshold) activeCount++;
      if (agent.hasAlpha) alphaCount++;
    }

    return {
      totalAgents: agents.length,
      activeAgents: activeCount,
      byFramework,
      avgPnl7d: agents.length > 0 ? totalPnl / agents.length : 0,
      alphaAgentCount: alphaCount,
    };
  }

  /**
   * Get recent signals for monitoring.
   */
  getRecentSignals(limit = 50): AIAgentSignal[] {
    return this.recentSignals.slice(-limit);
  }

  // ── Scoring ───────────────────────────────────────────────────────

  /**
   * Agent-specific scoring (different from human wallet scoring).
   *
   * Weights:
   * - PnL (40%): Profit is the only truth
   * - Consistency (30%): Agents should be consistently profitable
   * - Activity (20%): Need enough data to judge
   * - Safety (10%): Penalize rug-adjacent behavior
   */
  private calculateAgentScore(m: WalletMetrics): number {
    const pnlScore = Math.max(0, Math.min(m.pnl30d / 50, 1)) * 40;
    const consistencyScore = Math.max(0, Math.min(m.winRate30d, 1)) * 30;
    const activityScore = Math.max(0, Math.min(m.tradeCount30d / 200, 1)) * 20;
    const safetyScore = Math.max(0, 1 - Math.min(m.rugPullCount / 5, 1)) * 10;

    return Math.round((pnlScore + consistencyScore + activityScore + safetyScore) * 10) / 10;
  }

  // ── Persistence ───────────────────────────────────────────────────

  private async persistAgent(profile: AIAgentProfile): Promise<void> {
    const key = `${this.cachePrefix}${profile.address}`;
    await this.redisClient.setex(key, AGENT_TTL_SECS, JSON.stringify(profile));
  }

  async loadFromCache(): Promise<void> {
    const pattern = `${this.cachePrefix}*`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redisClient.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await this.redisClient.get(key);
        if (!raw) continue;
        try {
          const profile: AIAgentProfile = JSON.parse(raw);
          this.agents.set(profile.address, profile);
        } catch {
          // Skip
        }
      }
    } while (cursor !== '0');

    this.logger.log(`Loaded ${this.agents.size} AI agent profiles from cache`);
  }

  /**
   * Weekly refresh: re-scan all high-frequency wallets for agent patterns.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async weeklyRefresh(): Promise<void> {
    this.logger.log('Starting weekly AI agent detection refresh...');

    // Check all scored wallets for agent patterns
    const scores = this.walletScorerService.getAllScores();
    let newDetections = 0;

    for (const [addr, score] of scores) {
      if (this.agents.has(addr)) continue; // Already known

      // Check behavioral patterns
      const m = score.metrics;
      const tradesPerDay = m.tradeCount30d / 30;

      if (
        tradesPerDay >= AGENT_DETECTION.minTradesPerDay &&
        m.avgPositionSize <= AGENT_DETECTION.maxAvgPositionSol
      ) {
        const result = await this.detectAgent(addr, m);
        if (result) newDetections++;
      }
    }

    this.logger.log(
      `Weekly AI agent refresh complete: ${newDetections} new agents detected, ` +
      `${this.agents.size} total`,
    );
  }
}
