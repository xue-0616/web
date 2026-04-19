import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';

// ── Interfaces ────────────────────────────────────────────────────────

export interface WalletCluster {
  /** Addresses in this cluster (first address is the representative) */
  addresses: string[];
  /** Confidence that these addresses are controlled by the same entity (0-1) */
  confidence: number;
  /** Evidence descriptions */
  evidence: string[];
}

export interface ClusterEvidence {
  type: 'bundle' | 'timing' | 'funding' | 'circular' | 'portfolio';
  weight: number;
  detail: string;
}

// ── Constants ─────────────────────────────────────────────────────────

const CLUSTER_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:ADDR_CLUSTER:`;
const PAIR_CACHE_PREFIX = (env: string) =>
  `${env}:DEXAUTO:ADDR_PAIR:`;
const CLUSTER_TTL_SECS = 86400 * 7; // 7 days

/** Threshold above which two wallets are considered related */
const CLUSTER_CONFIDENCE_THRESHOLD = 0.6;

/** Maximum time delta (ms) for "synchronized" trading */
const SYNC_TRADE_MAX_DELTA_MS = 3000;

// ── Service ───────────────────────────────────────────────────────────

@Injectable()
export class AddressClusterService {
  private readonly logger = new Logger(AddressClusterService.name);
  private readonly clusterPrefix: string;
  private readonly pairPrefix: string;

  /** In-memory cluster map: address → representative address */
  private entityMap = new Map<string, string>();
  /** Cluster data */
  private clusters: WalletCluster[] = [];

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    const env = this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase();
    this.clusterPrefix = CLUSTER_CACHE_PREFIX(env);
    this.pairPrefix = PAIR_CACHE_PREFIX(env);
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Get the representative entity for an address.
   * If clustered, returns the cluster representative. Otherwise returns the address itself.
   */
  getEntity(address: string): string {
    return this.entityMap.get(address) ?? address;
  }

  /**
   * Get all clusters.
   */
  getClusters(): WalletCluster[] {
    return this.clusters;
  }

  /**
   * Deduplicate consensus transactions by merging clustered addresses.
   * Same cluster = 1 vote, no matter how many addresses in the cluster triggered.
   */
  deduplicateConsensus<T extends { address: string }>(
    items: T[],
    getAddress: (item: T) => string,
  ): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const entity = this.getEntity(getAddress(item));
      if (seen.has(entity)) return false;
      seen.add(entity);
      return true;
    });
  }

  /**
   * Record that two addresses appeared in the same Jito bundle.
   * This is the strongest clustering signal (weight 0.6).
   */
  async recordBundlePair(addr1: string, addr2: string): Promise<void> {
    await this.recordPairEvidence(addr1, addr2, {
      type: 'bundle',
      weight: 0.6,
      detail: `Appeared in same Jito bundle at ${new Date().toISOString()}`,
    });
  }

  /**
   * Record that two addresses traded the same token within SYNC_TRADE_MAX_DELTA_MS.
   * Timing signal (weight 0.3).
   */
  async recordSynchronizedTrade(
    addr1: string,
    addr2: string,
    tokenMint: string,
    timeDeltaMs: number,
  ): Promise<void> {
    if (timeDeltaMs > SYNC_TRADE_MAX_DELTA_MS) return;

    await this.recordPairEvidence(addr1, addr2, {
      type: 'timing',
      weight: 0.3,
      detail: `Traded ${tokenMint.slice(0, 8)}... within ${timeDeltaMs}ms`,
    });
  }

  /**
   * Record that two addresses share the same SOL funding source.
   * Funding signal (weight 0.4).
   */
  async recordSharedFunding(
    addr1: string,
    addr2: string,
    fundingSource: string,
  ): Promise<void> {
    await this.recordPairEvidence(addr1, addr2, {
      type: 'funding',
      weight: 0.4,
      detail: `Shared funding source: ${fundingSource.slice(0, 8)}...`,
    });
  }

  /**
   * Record circular fund flow between two addresses.
   * Strongest non-bundle signal (weight 0.5).
   */
  async recordCircularFlow(addr1: string, addr2: string, tokenMint: string): Promise<void> {
    await this.recordPairEvidence(addr1, addr2, {
      type: 'circular',
      weight: 0.5,
      detail: `Circular flow detected via ${tokenMint.slice(0, 8)}...`,
    });
  }

  // ── Cluster Rebuild ─────────────────────────────────────────────────

  /**
   * Rebuild clusters from accumulated pair evidence.
   * Run weekly or on-demand.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async rebuildClusters(): Promise<void> {
    this.logger.log('Rebuilding address clusters...');

    const pairs = await this.loadAllPairScores();
    const adjacency = new Map<string, Map<string, number>>();

    // Build adjacency graph
    for (const [pairKey, score] of pairs) {
      if (score < CLUSTER_CONFIDENCE_THRESHOLD) continue;

      const [a, b] = pairKey.split(':');
      if (!adjacency.has(a)) adjacency.set(a, new Map());
      if (!adjacency.has(b)) adjacency.set(b, new Map());
      adjacency.get(a)!.set(b, score);
      adjacency.get(b)!.set(a, score);
    }

    // Union-Find clustering
    const parent = new Map<string, string>();

    function find(x: string): string {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    }

    function union(x: string, y: string): void {
      const px = find(x);
      const py = find(y);
      if (px !== py) parent.set(px, py);
    }

    for (const [addr, neighbors] of adjacency) {
      for (const [neighbor] of neighbors) {
        union(addr, neighbor);
      }
    }

    // Group by cluster representative
    const clusterMap = new Map<string, string[]>();
    for (const addr of adjacency.keys()) {
      const rep = find(addr);
      if (!clusterMap.has(rep)) clusterMap.set(rep, []);
      clusterMap.get(rep)!.push(addr);
    }

    // Build cluster objects
    this.clusters = [];
    this.entityMap.clear();

    for (const [, addrs] of clusterMap) {
      if (addrs.length < 2) continue; // Not a cluster

      // Sort addresses for deterministic representative selection.
      // This ensures getEntity(x) returns the same value across rebuild/reload cycles.
      const sortedAddrs = [...addrs].sort();
      const stableRep = sortedAddrs[0];

      // Calculate average confidence and gather evidence
      let totalScore = 0;
      let pairCount = 0;
      const evidence: string[] = [];

      for (let i = 0; i < sortedAddrs.length; i++) {
        for (let j = i + 1; j < sortedAddrs.length; j++) {
          const score = adjacency.get(sortedAddrs[i])?.get(sortedAddrs[j]) ?? 0;
          if (score > 0) {
            totalScore += score;
            pairCount++;
          }
        }
      }

      const avgConfidence = pairCount > 0 ? totalScore / pairCount : 0;
      evidence.push(`${sortedAddrs.length} addresses, ${pairCount} pair(s), avg confidence ${avgConfidence.toFixed(2)}`);

      const cluster: WalletCluster = {
        addresses: sortedAddrs,
        confidence: avgConfidence,
        evidence,
      };

      this.clusters.push(cluster);

      // Map all addresses to the stable (sorted-first) representative, matching loadClusters()
      for (const addr of sortedAddrs) {
        this.entityMap.set(addr, stableRep);
      }
    }

    // Persist clusters to Redis
    await this.redisClient.setex(
      `${this.clusterPrefix}ALL`,
      CLUSTER_TTL_SECS,
      JSON.stringify(this.clusters),
    );

    this.logger.log(
      `Rebuilt ${this.clusters.length} clusters covering ${this.entityMap.size} addresses`,
    );
  }

  /**
   * Load clusters from Redis cache on startup.
   */
  async loadClusters(): Promise<void> {
    const raw = await this.redisClient.get(`${this.clusterPrefix}ALL`);
    if (!raw) return;

    try {
      this.clusters = JSON.parse(raw) as WalletCluster[];
      this.entityMap.clear();
      for (const cluster of this.clusters) {
        const rep = cluster.addresses[0];
        for (const addr of cluster.addresses) {
          this.entityMap.set(addr, rep);
        }
      }
      this.logger.log(`Loaded ${this.clusters.length} clusters from cache`);
    } catch {
      this.logger.warn('Failed to parse cluster cache');
    }
  }

  // ── Internal Evidence Tracking ──────────────────────────────────────

  private async recordPairEvidence(
    addr1: string,
    addr2: string,
    evidence: ClusterEvidence,
  ): Promise<void> {
    // Normalize pair key (alphabetical order)
    const [a, b] = [addr1, addr2].sort();
    const pairKey = `${this.pairPrefix}${a}:${b}`;

    // Load existing evidence
    const raw = await this.redisClient.get(pairKey);
    const existingEvidence: ClusterEvidence[] = raw ? JSON.parse(raw) : [];

    // Avoid duplicate evidence of same type (keep highest weight)
    const idx = existingEvidence.findIndex((e) => e.type === evidence.type);
    if (idx >= 0) {
      if (existingEvidence[idx].weight < evidence.weight) {
        existingEvidence[idx] = evidence;
      }
    } else {
      existingEvidence.push(evidence);
    }

    await this.redisClient.setex(pairKey, CLUSTER_TTL_SECS, JSON.stringify(existingEvidence));
  }

  private async loadAllPairScores(): Promise<Map<string, number>> {
    const pattern = `${this.pairPrefix}*`;
    const pairs = new Map<string, number>();
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
        if (!raw) continue;

        try {
          const evidence: ClusterEvidence[] = JSON.parse(raw);
          // Sum weights (capped at 1.0)
          const totalScore = Math.min(
            1.0,
            evidence.reduce((sum, e) => sum + e.weight, 0),
          );
          // Extract pair from key
          const pairPart = key.replace(this.pairPrefix, '');
          pairs.set(pairPart, totalScore);
        } catch {
          // Skip malformed
        }
      }
    } while (cursor !== '0');

    return pairs;
  }
}
