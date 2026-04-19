import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PositionManagerService, ManagedPosition } from './position-manager.service';

// ── Interfaces ────────────────────────────────────────────────────────

export interface FundAllocationConfig {
  /** Total budget in SOL */
  totalBudgetSol: number;
  /** Maximum SOL per single trade */
  maxSingleTradeSol: number;
  /** Maximum exposure to a single token as ratio of total budget (0-1) */
  maxSingleTokenExposure: number;
  /** Maximum number of concurrent open positions */
  maxConcurrentPositions: number;
  /** Minimum trade amount in SOL (below this, fees are not worthwhile) */
  minTradeAmount: number;
  /** Allocation tiers: higher consensus score → larger allocation */
  allocationTiers: AllocationTier[];
}

export interface AllocationTier {
  /** Minimum weighted consensus score for this tier */
  consensusScore: number;
  /** Allocation ratio of maxSingleTradeSol (0-1) */
  allocRatio: number;
}

export interface AllocationDecision {
  /** Whether to proceed with the trade */
  proceed: boolean;
  /** SOL amount to trade (0 if not proceeding) */
  amountSol: number;
  /** Reason for the decision */
  reason: string;
  /** Which allocation tier was matched */
  tier?: AllocationTier;
}

export interface FundStatus {
  totalBudgetSol: number;
  usedSol: number;
  availableSol: number;
  openPositionCount: number;
  maxPositions: number;
  utilizationPct: number;
}

// ── Default Config ────────────────────────────────────────────────────

const DEFAULT_CONFIG: FundAllocationConfig = {
  totalBudgetSol: 10,
  maxSingleTradeSol: 1,
  // Top-PnL Solana whale wallets (2026 benchmark: techmagazines.net whale study)
  // keep single-token exposure below 10% of portfolio. Setting 0.1 aligns our
  // system defaults with verified top-trader risk management behavior.
  maxSingleTokenExposure: 0.1,
  maxConcurrentPositions: 15,
  minTradeAmount: 0.05,
  allocationTiers: [
    { consensusScore: 10, allocRatio: 1.0 },  // Super strong consensus → full allocation
    { consensusScore: 6, allocRatio: 0.5 },   // Strong consensus → half
    { consensusScore: 4, allocRatio: 0.2 },   // Moderate consensus → small position
    { consensusScore: 2, allocRatio: 0.1 },   // Weak consensus → minimal
  ],
};

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class FundAllocatorService {
  private readonly logger = new Logger(FundAllocatorService.name);
  private config: FundAllocationConfig;

  constructor(
    private readonly positionManager: PositionManagerService,
  ) {
    this.config = { ...DEFAULT_CONFIG };
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Update allocation config at runtime.
   */
  updateConfig(newConfig: Partial<FundAllocationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log(
      `Fund allocation config updated: budget=${this.config.totalBudgetSol} SOL, ` +
      `maxSingle=${this.config.maxSingleTradeSol} SOL, maxPositions=${this.config.maxConcurrentPositions}`,
    );
  }

  getConfig(): FundAllocationConfig {
    return { ...this.config };
  }

  /**
   * Calculate optimal trade amount for a consensus signal.
   *
   * Decision process:
   * 1. Check if we have room for more positions
   * 2. Check available funds
   * 3. Match consensus score to allocation tier
   * 4. Apply single-token exposure limit
   * 5. Verify amount exceeds minimum threshold
   * 6. Apply entry deviation adjustment if provided
   */
  async calculateTradeAmount(
    userId: string,
    tokenMint: string,
    weightedConsensusScore: number,
    entryDeviationPct?: number,
  ): Promise<AllocationDecision> {
    // Step 1: Check position count
    const openPositions = await this.positionManager.getOpenPositions(userId);
    if (openPositions.length >= this.config.maxConcurrentPositions) {
      return {
        proceed: false,
        amountSol: 0,
        reason: `Max concurrent positions reached: ${openPositions.length}/${this.config.maxConcurrentPositions}`,
      };
    }

    // Step 2: Calculate available funds
    const usedSol = this.calculateUsedSol(openPositions);
    const availableSol = Math.max(0, this.config.totalBudgetSol - usedSol);

    if (availableSol < this.config.minTradeAmount) {
      return {
        proceed: false,
        amountSol: 0,
        reason: `Insufficient funds: ${availableSol.toFixed(3)} SOL available (min: ${this.config.minTradeAmount})`,
      };
    }

    // Step 3: Match allocation tier (tiers sorted high→low by consensusScore)
    const sortedTiers = [...this.config.allocationTiers].sort(
      (a, b) => b.consensusScore - a.consensusScore,
    );

    let matchedTier: AllocationTier | undefined;
    for (const tier of sortedTiers) {
      if (weightedConsensusScore >= tier.consensusScore) {
        matchedTier = tier;
        break;
      }
    }

    if (!matchedTier) {
      return {
        proceed: false,
        amountSol: 0,
        reason: `Consensus score ${weightedConsensusScore} too low for any allocation tier (min: ${sortedTiers[sortedTiers.length - 1]?.consensusScore ?? 'N/A'})`,
      };
    }

    let tradeAmount = this.config.maxSingleTradeSol * matchedTier.allocRatio;

    // Step 4: Apply single-token exposure limit
    const existingPosition = openPositions.find(
      (p) => p.tokenMint === tokenMint,
    );
    const existingExposure = existingPosition
      ? new Decimal(existingPosition.totalSolInvested).toNumber()
      : 0;
    const maxTokenExposure = this.config.totalBudgetSol * this.config.maxSingleTokenExposure;
    const remainingTokenBudget = Math.max(0, maxTokenExposure - existingExposure);

    // Check exposure cap BEFORE capping tradeAmount so the rejection reason reflects
    // the actual limit rather than the clamped value.
    if (remainingTokenBudget <= 0) {
      return {
        proceed: false,
        amountSol: 0,
        reason: `Token exposure limit reached: ${existingExposure.toFixed(3)} SOL already in ${tokenMint.slice(0, 8)}... (max: ${maxTokenExposure.toFixed(3)})`,
        tier: matchedTier,
      };
    }

    tradeAmount = Math.min(tradeAmount, remainingTokenBudget);

    // Step 5: Cap by available funds
    tradeAmount = Math.min(tradeAmount, availableSol);

    // Step 6: Apply entry deviation adjustment
    // If our entry price is 5-15% worse than smart money, reduce position proportionally
    if (entryDeviationPct !== undefined && entryDeviationPct > 0.05) {
      const deviationFactor = Math.max(0, 1 - entryDeviationPct);
      const adjustedAmount = tradeAmount * deviationFactor;
      this.logger.log(
        `Entry deviation ${(entryDeviationPct * 100).toFixed(1)}%: ` +
        `reducing allocation from ${tradeAmount.toFixed(3)} to ${adjustedAmount.toFixed(3)} SOL`,
      );
      tradeAmount = adjustedAmount;
    }

    // Step 7: Check minimum threshold
    if (tradeAmount < this.config.minTradeAmount) {
      return {
        proceed: false,
        amountSol: 0,
        reason: `Calculated amount ${tradeAmount.toFixed(3)} SOL below minimum ${this.config.minTradeAmount} SOL`,
        tier: matchedTier,
      };
    }

    // Round to 4 decimal places
    tradeAmount = Math.round(tradeAmount * 10000) / 10000;

    return {
      proceed: true,
      amountSol: tradeAmount,
      reason: `Allocated ${tradeAmount.toFixed(4)} SOL (consensus=${weightedConsensusScore}, tier=${matchedTier.allocRatio * 100}%, available=${availableSol.toFixed(3)})`,
      tier: matchedTier,
    };
  }

  /**
   * Get current fund utilization status.
   */
  async getFundStatus(userId: string): Promise<FundStatus> {
    const openPositions = await this.positionManager.getOpenPositions(userId);
    const usedSol = this.calculateUsedSol(openPositions);
    const availableSol = Math.max(0, this.config.totalBudgetSol - usedSol);

    return {
      totalBudgetSol: this.config.totalBudgetSol,
      usedSol,
      availableSol,
      openPositionCount: openPositions.length,
      maxPositions: this.config.maxConcurrentPositions,
      utilizationPct: (usedSol / this.config.totalBudgetSol) * 100,
    };
  }

  // ── Internal ────────────────────────────────────────────────────────

  private calculateUsedSol(positions: ManagedPosition[]): number {
    let total = 0;
    for (const pos of positions) {
      if (!pos.isClosed) {
        // Net invested = totalInvested - totalRecovered
        const net = new Decimal(pos.totalSolInvested)
          .sub(pos.totalSolRecovered)
          .toNumber();
        total += Math.max(0, net);
      }
    }
    return total;
  }
}
