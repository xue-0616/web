import { Injectable, Logger } from '@nestjs/common';
import { AddressClusterService, WalletCluster } from './address-cluster.service';
import { WalletScorerService } from './wallet-scorer.service';

// ── Interfaces ────────────────────────────────────────────────────────

/**
 * A suspicious consensus event where clustered wallets may have
 * artificially inflated the consensus count.
 */
export interface WashTradeAlert {
  tokenMint: string;
  /** Original trader addresses that triggered consensus */
  traderAddresses: string[];
  /** Addresses that belong to the same cluster */
  clusteredAddresses: string[];
  /** Cluster representative */
  clusterRepresentative: string;
  /** Number of real (deduplicated) consensus entities */
  realConsensusCount: number;
  /** Original (inflated) consensus count */
  originalConsensusCount: number;
  /** Whether this likely constitutes wash trading */
  isWashTrade: boolean;
  timestamp: number;
}

/**
 * Result of consensus deduplication including wash trade analysis.
 */
export interface DeduplicatedConsensus {
  /** Original transactions */
  originalCount: number;
  /** After deduplication */
  deduplicatedCount: number;
  /** Wash trade alerts generated */
  alerts: WashTradeAlert[];
  /** Whether the consensus is still valid after dedup */
  isValid: boolean;
  /** Reason if invalid */
  reason?: string;
}

/**
 * Transaction data for consensus analysis.
 */
export interface ConsensusTx {
  monitorAddress: string;
  tokenMint: string;
  txId: string;
  blockTime: number;
  solAmount: number;
}

// ── Constants ─────────────────────────────────────────────────────────

/**
 * If deduplication reduces consensus count by more than this ratio,
 * flag as potential wash trading.
 */
const WASH_TRADE_REDUCTION_THRESHOLD = 0.4;

/**
 * Minimum original consensus count before wash trade analysis applies.
 * Single-address triggers can't be wash trades.
 */
const MIN_CONSENSUS_FOR_WASH_CHECK = 3;

/**
 * If more than this fraction of consensus comes from a single cluster,
 * flag as suspicious even if total count is high.
 */
const SINGLE_CLUSTER_DOMINANCE_THRESHOLD = 0.6;

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class WashTradeDetectorService {
  private readonly logger = new Logger(WashTradeDetectorService.name);

  /** Rolling alert history for monitoring */
  private recentAlerts: WashTradeAlert[] = [];
  private readonly maxAlertHistory = 500;

  constructor(
    private readonly addressClusterService: AddressClusterService,
    private readonly walletScorerService: WalletScorerService,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Analyze a set of consensus transactions for wash trading.
   *
   * Steps:
   * 1. Get cluster info for all trader addresses
   * 2. Deduplicate: same cluster = 1 vote
   * 3. Check if dedup reduced count significantly (wash trade signal)
   * 4. Check for single-cluster dominance
   * 5. Return cleaned consensus with alerts
   */
  analyzeConsensus(txs: ConsensusTx[]): DeduplicatedConsensus {
    if (txs.length === 0) {
      return { originalCount: 0, deduplicatedCount: 0, alerts: [], isValid: false, reason: 'No transactions' };
    }

    const tokenMint = txs[0].tokenMint;
    const traderAddresses = txs.map((tx) => tx.monitorAddress);
    const originalCount = new Set(traderAddresses).size;

    // Step 1: Map each address to its cluster entity
    const entityToAddresses = new Map<string, string[]>();
    for (const addr of new Set(traderAddresses)) {
      const entity = this.addressClusterService.getEntity(addr);
      if (!entityToAddresses.has(entity)) {
        entityToAddresses.set(entity, []);
      }
      entityToAddresses.get(entity)!.push(addr);
    }

    const deduplicatedCount = entityToAddresses.size;
    const alerts: WashTradeAlert[] = [];

    // Step 2: Check for significant reduction (wash trade signal)
    if (originalCount >= MIN_CONSENSUS_FOR_WASH_CHECK) {
      const reductionRatio = 1 - deduplicatedCount / originalCount;

      if (reductionRatio >= WASH_TRADE_REDUCTION_THRESHOLD) {
        // Find which clusters caused the inflation
        for (const [entity, addrs] of entityToAddresses) {
          if (addrs.length > 1) {
            const alert: WashTradeAlert = {
              tokenMint,
              traderAddresses,
              clusteredAddresses: addrs,
              clusterRepresentative: entity,
              realConsensusCount: deduplicatedCount,
              originalConsensusCount: originalCount,
              isWashTrade: true,
              timestamp: Date.now(),
            };
            alerts.push(alert);
            this.addAlert(alert);

            this.logger.warn(
              `WASH TRADE detected for ${tokenMint.slice(0, 8)}...: ` +
              `cluster ${entity.slice(0, 8)}... inflated consensus from ${deduplicatedCount} to ${originalCount} ` +
              `(${addrs.length} addresses in cluster)`,
            );
          }
        }
      }
    }

    // Step 3: Check for single-cluster dominance
    for (const [entity, addrs] of entityToAddresses) {
      const dominanceRatio = addrs.length / originalCount;
      if (dominanceRatio >= SINGLE_CLUSTER_DOMINANCE_THRESHOLD && originalCount >= MIN_CONSENSUS_FOR_WASH_CHECK) {
        const existing = alerts.find((a) => a.clusterRepresentative === entity);
        if (!existing) {
          const alert: WashTradeAlert = {
            tokenMint,
            traderAddresses,
            clusteredAddresses: addrs,
            clusterRepresentative: entity,
            realConsensusCount: deduplicatedCount,
            originalConsensusCount: originalCount,
            isWashTrade: true,
            timestamp: Date.now(),
          };
          alerts.push(alert);
          this.addAlert(alert);

          this.logger.warn(
            `CLUSTER DOMINANCE for ${tokenMint.slice(0, 8)}...: ` +
            `cluster ${entity.slice(0, 8)}... controls ${(dominanceRatio * 100).toFixed(0)}% of consensus`,
          );
        }
      }
    }

    // Determine overall validity
    let isValid = true;
    let reason: string | undefined;

    if (deduplicatedCount < 2) {
      isValid = false;
      reason = `After dedup, only ${deduplicatedCount} real entity — insufficient consensus`;
    } else if (alerts.length > 0 && deduplicatedCount < 3) {
      isValid = false;
      reason = `Wash trade detected and real consensus (${deduplicatedCount}) too low`;
    }

    return {
      originalCount,
      deduplicatedCount,
      alerts,
      isValid,
      reason,
    };
  }

  /**
   * Quick check: should we trust this set of trader addresses for consensus?
   * Returns true if consensus appears genuine.
   */
  isGenuineConsensus(traderAddresses: string[]): boolean {
    const uniqueAddrs = [...new Set(traderAddresses)];
    if (uniqueAddrs.length < 2) return uniqueAddrs.length > 0;

    const entitySet = new Set<string>();
    for (const addr of uniqueAddrs) {
      entitySet.add(this.addressClusterService.getEntity(addr));
    }

    // After dedup, need at least 2 real entities
    return entitySet.size >= 2;
  }

  /**
   * Record that two addresses traded the same token at similar times.
   * Feeds data to AddressClusterService for future cluster detection.
   */
  async recordCoincidentTrades(
    addr1: string,
    addr2: string,
    tokenMint: string,
    timeDeltaMs: number,
  ): Promise<void> {
    await this.addressClusterService.recordSynchronizedTrade(
      addr1, addr2, tokenMint, timeDeltaMs,
    );
  }

  /**
   * Get recent wash trade alerts for monitoring dashboard.
   */
  getRecentAlerts(limit = 50): WashTradeAlert[] {
    return this.recentAlerts.slice(-limit);
  }

  /**
   * Get statistics on wash trade detection.
   */
  getStats(): {
    totalAlerts: number;
    uniqueTokens: number;
    uniqueClusters: number;
  } {
    const tokenSet = new Set(this.recentAlerts.map((a) => a.tokenMint));
    const clusterSet = new Set(this.recentAlerts.map((a) => a.clusterRepresentative));
    return {
      totalAlerts: this.recentAlerts.length,
      uniqueTokens: tokenSet.size,
      uniqueClusters: clusterSet.size,
    };
  }

  // ── Internal ────────────────────────────────────────────────────────

  private addAlert(alert: WashTradeAlert): void {
    this.recentAlerts.push(alert);
    if (this.recentAlerts.length > this.maxAlertHistory) {
      this.recentAlerts = this.recentAlerts.slice(-this.maxAlertHistory);
    }
  }
}
