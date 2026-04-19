import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClickHouseService } from '../../infrastructure/clickhouse/clickhouse.service';
import {
  ImportWalletCandidateInput,
  SmartWalletCandidate,
  SmartWalletSourceService,
} from './smart-wallet-source.service';
import { GeyserSubscriberService } from '../geyser-subscriber/geyser-subscriber.service';
import { TokenSecurityService } from '../token-security/token-security.service';

export interface DiscoveredWalletMetricsRow {
  address: string;
  pnl30d?: number;
  winRate30d?: number;
  avgHoldTime?: number;
  tradeCount30d?: number;
  avgPositionSize?: number;
  recentAvgPositionSize?: number;
  maxDrawdown?: number;
  rugPullCount?: number;
  bundleCount?: number;
  bondingCurveTradeRatio?: number;
  dexTradeCount?: number;
  sourceLabel?: string;
}

// Pump.fun program IDs (bonding curve + AMM migration)
const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMP_AMM_PROGRAM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

/**
 * Sub-query: identify insider bundle participants.
 *
 * Pattern: 10+ unique traders buy the same token in the same block_slot
 * via Pump.fun bonding curve. This indicates a coordinated insider group
 * that bought at launch block — their PnL is not replicable.
 *
 * These addresses are excluded from the main discovery query.
 */
const INSIDER_BUNDLE_BLACKLIST = `
  SELECT DISTINCT trader
  FROM dex_trades
  WHERE block_time >= now() - INTERVAL 30 DAY
    AND (outer_program = '${PUMP_FUN_PROGRAM}' OR inner_program = '${PUMP_FUN_PROGRAM}')
    AND toFloat64(usd_value) < 0  -- buys (spending SOL)
    AND (base_mint, block_slot) IN (
      SELECT base_mint, block_slot
      FROM dex_trades
      WHERE block_time >= now() - INTERVAL 30 DAY
        AND (outer_program = '${PUMP_FUN_PROGRAM}' OR inner_program = '${PUMP_FUN_PROGRAM}')
        AND toFloat64(usd_value) < 0
      GROUP BY base_mint, block_slot
      HAVING uniqExact(trader) >= 10
    )
`;

const DISCOVERY_QUERY = `
SELECT
  trader AS address,
  -- Total PnL from all trades
  round(sum(toFloat64(usd_value)) / 100.0, 2) AS pnl30d,
  -- PnL excluding Pump.fun bonding curve trades (only DEX-traded tokens)
  round(sumIf(toFloat64(usd_value),
    outer_program != '${PUMP_FUN_PROGRAM}'
    AND inner_program != '${PUMP_FUN_PROGRAM}'
  ) / 100.0, 2) AS dexOnlyPnl30d,
  if(count() = 0, 0.5, round(countIf(toFloat64(usd_value) > 0) / count(), 4)) AS winRate30d,
  round(
    (max(block_time) - min(block_time)) / greatest(count() - 1, 1), 0
  ) AS avgHoldTime,
  count() AS tradeCount30d,
  round(avg(abs(toFloat64(usd_value))) / 100.0, 4) AS avgPositionSize,
  -- 7-day recent average position size (captures style drift for probe buy detection)
  round(avgIf(abs(toFloat64(usd_value)), block_time >= now() - INTERVAL 7 DAY) / 100.0, 4) AS recentAvgPositionSize,
  -- maxDrawdown: ratio of total losses to total gains
  if(
    sumIf(toFloat64(usd_value), toFloat64(usd_value) > 0) = 0, 1.0,
    round(least(
      abs(sumIf(toFloat64(usd_value), toFloat64(usd_value) < 0))
      / sumIf(toFloat64(usd_value), toFloat64(usd_value) > 0), 1.0
    ), 4)
  ) AS maxDrawdown,
  -- bundleCount: trades with inner instructions (heuristic for bundled/dev)
  countIf(inner_instruction_index > 0) AS bundleCount,
  0 AS rugPullCount,
  -- Ratio of trades on Pump.fun bonding curve vs total
  round(countIf(
    outer_program = '${PUMP_FUN_PROGRAM}'
    OR inner_program = '${PUMP_FUN_PROGRAM}'
  ) / count(), 4) AS bondingCurveTradeRatio,
  -- Number of trades on real DEXes (post-graduation)
  countIf(
    outer_program != '${PUMP_FUN_PROGRAM}'
    AND inner_program != '${PUMP_FUN_PROGRAM}'
  ) AS dexTradeCount,
  'clickhouse_top_trader_30d' AS sourceLabel
FROM dex_trades
WHERE block_time >= now() - INTERVAL 30 DAY
  AND trader != ''
  -- Exclude insider bundle group participants (10+ wallets buying same token in same block)
  AND trader NOT IN (${INSIDER_BUNDLE_BLACKLIST})
GROUP BY trader
HAVING
  count() >= 25                                           -- minimum activity threshold
  AND countIf(toFloat64(usd_value) > 0) / count() > 0.4  -- win rate > 40%
  AND sum(toFloat64(usd_value)) > 0                       -- must be net profitable
  -- Must have meaningful DEX trades, not purely bonding curve sniping
  AND countIf(
    outer_program != '${PUMP_FUN_PROGRAM}'
    AND inner_program != '${PUMP_FUN_PROGRAM}'
  ) >= 5
ORDER BY pnl30d DESC, winRate30d DESC
LIMIT 200
`;

@Injectable()
export class OnchainWalletDiscoveryService {
  private readonly logger = new Logger(OnchainWalletDiscoveryService.name);

  constructor(
    private readonly clickHouseService: ClickHouseService,
    private readonly smartWalletSourceService: SmartWalletSourceService,
    @Optional()
    private readonly tokenSecurityService?: TokenSecurityService,
    @Optional()
    private readonly geyserSubscriberService?: GeyserSubscriberService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async discoverOnchainWallets(): Promise<void> {
    try {
      const candidates = await this.runDiscovery();
      this.logger.log(`On-chain discovery imported ${candidates.length} candidates`);
      if (this.geyserSubscriberService && candidates.length > 0) {
        this.geyserSubscriberService.addMonitorAddresses(
          this.smartWalletSourceService.getSystemMonitorAddresses(),
        );
      }
    } catch (error) {
      this.logger.error(`On-chain wallet discovery failed: ${(error as Error).message}`);
    }
  }

  async runDiscovery(): Promise<SmartWalletCandidate[]> {
    const rows = await this.clickHouseService.query(DISCOVERY_QUERY);
    const items: ImportWalletCandidateInput[] = rows
      .map((row) => this.toImportItem(row as DiscoveredWalletMetricsRow))
      .filter((item): item is ImportWalletCandidateInput => Boolean(item));

    // Enrich with token security checks (unsafeTokenRatio)
    if (this.tokenSecurityService && items.length > 0) {
      await this.enrichWithTokenSecurity(items);
    }

    return this.smartWalletSourceService.importCandidates('onchain_discovery', items);
  }

  /**
   * For each candidate, query their most-traded tokens from ClickHouse,
   * sample-check via TokenSecurityService, and set unsafeTokenRatio.
   * Limits to top 5 tokens per wallet and max 10 concurrent checks for rate limits.
   */
  private async enrichWithTokenSecurity(
    items: ImportWalletCandidateInput[],
  ): Promise<void> {
    const addresses = items.map((i) => i.address);
    const TOKENS_PER_WALLET = 5;

    // Batch query: top N tokens per candidate by trade count
    const tokenQuery = `
      SELECT
        trader AS address,
        base_mint AS mint,
        count() AS cnt
      FROM dex_trades
      WHERE block_time >= now() - INTERVAL 30 DAY
        AND trader IN (${addresses.map((a) => `'${a}'`).join(',')})
        AND base_mint != ''
      GROUP BY trader, base_mint
      ORDER BY trader, cnt DESC
    `;

    let tokenRows: Array<{ address: string; mint: string; cnt: number }>;
    try {
      tokenRows = await this.clickHouseService.query(tokenQuery) as any[];
    } catch (err) {
      this.logger.warn(`Token security enrichment query failed: ${(err as Error).message}`);
      return;
    }

    // Group: top N tokens per wallet
    const walletTokens = new Map<string, string[]>();
    for (const row of tokenRows) {
      const addr = row.address;
      if (!walletTokens.has(addr)) {
        walletTokens.set(addr, []);
      }
      const list = walletTokens.get(addr)!;
      if (list.length < TOKENS_PER_WALLET) {
        list.push(row.mint);
      }
    }

    // Deduplicate all mints for batch checking
    const allMints = new Set<string>();
    for (const mints of walletTokens.values()) {
      for (const m of mints) allMints.add(m);
    }

    // Check each unique mint (with concurrency limit)
    const mintResults = new Map<string, boolean>();
    const mintArray = Array.from(allMints);
    const BATCH_SIZE = 10;

    for (let i = 0; i < mintArray.length; i += BATCH_SIZE) {
      const batch = mintArray.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (mint) => {
          const result = await this.tokenSecurityService!.checkTokenSecurity(mint);
          return { mint, safe: result.passesFilter };
        }),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          mintResults.set(r.value.mint, r.value.safe);
        }
      }
    }

    // Compute unsafeTokenRatio per wallet and inject into metrics
    for (const item of items) {
      const mints = walletTokens.get(item.address);
      if (!mints || mints.length === 0) continue;
      const unsafeCount = mints.filter((m) => mintResults.get(m) === false).length;
      const ratio = unsafeCount / mints.length;
      if (item.metrics) {
        (item.metrics as any).unsafeTokenRatio = Math.round(ratio * 100) / 100;
      }
    }

    this.logger.log(
      `Token security enrichment: checked ${mintResults.size} unique tokens for ${items.length} wallets`,
    );
  }

  private toImportItem(
    row: DiscoveredWalletMetricsRow,
  ): ImportWalletCandidateInput | null {
    const address = row.address?.trim();
    if (!address) {
      return null;
    }

    const bondingRatio = this.toNumber(row.bondingCurveTradeRatio) ?? 0;

    // If >80% of trades are bonding curve sniping, skip entirely — not replicable
    if (bondingRatio > 0.8) {
      return null;
    }

    // If >50% bonding curve trades, use dexOnlyPnl to avoid inflating score
    // with un-replicable insider profits
    const rawPnl = this.toNumber(row.pnl30d) ?? 0;
    const dexOnlyPnl = this.toNumber((row as any).dexOnlyPnl30d) ?? rawPnl;
    const effectivePnl = bondingRatio > 0.5 ? dexOnlyPnl : rawPnl;

    return {
      address,
      sourceLabel: row.sourceLabel ?? 'clickhouse_discovery',
      isSystemMonitored: true,
      metrics: {
        pnl30d: effectivePnl,
        winRate30d: this.toNumber(row.winRate30d),
        avgHoldTime: this.toNumber(row.avgHoldTime),
        tradeCount30d: this.toNumber(row.tradeCount30d),
        avgPositionSize: this.toNumber(row.avgPositionSize),
        recentAvgPositionSize: this.toNumber((row as any).recentAvgPositionSize),
        maxDrawdown: this.toNumber(row.maxDrawdown),
        rugPullCount: this.toNumber(row.rugPullCount),
        bundleCount: this.toNumber(row.bundleCount),
      },
      rawData: {
        ...(row as Record<string, any>),
        bondingCurveTradeRatio: bondingRatio,
        dexTradeCount: this.toNumber(row.dexTradeCount) ?? 0,
      },
    };
  }

  private toNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
