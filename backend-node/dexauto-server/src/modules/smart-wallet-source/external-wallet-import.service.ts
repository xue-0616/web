import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ImportWalletCandidateInput,
  SmartWalletCandidate,
  SmartWalletSourceService,
  SmartWalletSourceType,
} from './smart-wallet-source.service';
import { GmgnClient, GmgnClientConfig } from './api-clients/gmgn.client';
import { BirdeyeClient, BirdeyeClientConfig } from './api-clients/birdeye.client';
import { CieloClient, CieloClientConfig } from './api-clients/cielo.client';
import {
  ChainFMSmartWalletClient,
  ChainFMSmartWalletConfig,
} from './api-clients/chainfm.client';

@Injectable()
export class ExternalWalletImportService implements OnModuleInit {
  private readonly logger = new Logger(ExternalWalletImportService.name);

  private gmgnClient: GmgnClient | null = null;
  private birdeyeClient: BirdeyeClient | null = null;
  private cieloClient: CieloClient | null = null;
  private chainfmClient: ChainFMSmartWalletClient | null = null;

  constructor(
    private readonly smartWalletSourceService: SmartWalletSourceService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.initClients();
    this.logger.log(
      `External import clients initialized: ` +
        `GMGN=${!!this.gmgnClient} Birdeye=${!!this.birdeyeClient} ` +
        `Cielo=${!!this.cieloClient} ChainFM=${!!this.chainfmClient}`,
    );
  }

  private initClients(): void {
    const gmgnApiKey = this.configService.get<string>('GMGN_API_KEY');
    const gmgnApiSecret = this.configService.get<string>('GMGN_API_SECRET');
    this.gmgnClient = new GmgnClient({
      apiKey: gmgnApiKey,
      apiSecret: gmgnApiSecret,
      useOfficialApi: !!gmgnApiKey,
    } as GmgnClientConfig);

    const birdeyeApiKey = this.configService.get<string>('BIRDEYE_API_KEY');
    if (birdeyeApiKey) {
      this.birdeyeClient = new BirdeyeClient({
        apiKey: birdeyeApiKey,
      } as BirdeyeClientConfig);
    }

    const cieloApiKey = this.configService.get<string>('CIELO_API_KEY');
    if (cieloApiKey) {
      this.cieloClient = new CieloClient({
        apiKey: cieloApiKey,
      } as CieloClientConfig);
    }

    const chainfmChannels = this.configService.get<string>('CHAINFM_CHANNEL_IDS');
    if (chainfmChannels) {
      const channelIds = chainfmChannels.split(',').map((id) => id.trim()).filter(Boolean);
      if (channelIds.length > 0) {
        this.chainfmClient = new ChainFMSmartWalletClient({
          channelIds,
        } as ChainFMSmartWalletConfig);
      }
    }
  }

  // ── Scheduled API Imports ───────────────────────────────────────────

  @Cron(CronExpression.EVERY_4_HOURS)
  async scheduledImportAll(): Promise<void> {
    this.logger.log('Starting scheduled external wallet import from all sources...');

    const results = await Promise.allSettled([
      this.importFromGmgn(),
      this.importFromBirdeye(),
      this.importFromCielo(),
      this.importFromChainFM(),
    ]);

    let totalImported = 0;
    const sourceNames = ['GMGN', 'Birdeye', 'Cielo', 'ChainFM'];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        totalImported += result.value.length;
        this.logger.log(`${sourceNames[index]}: imported ${result.value.length} candidates`);
      } else {
        this.logger.error(`${sourceNames[index]}: import failed - ${result.reason}`);
      }
    });

    this.logger.log(`Scheduled import complete: ${totalImported} total candidates imported`);
  }

  // ── Individual Source Imports ────────────────────────────────────────

  async importFromGmgn(): Promise<SmartWalletCandidate[]> {
    if (!this.gmgnClient) {
      this.logger.debug('GMGN client not configured, skipping');
      return [];
    }
    try {
      const items = await this.gmgnClient.fetchTopSmartWallets();
      if (items.length === 0) return [];
      return this.smartWalletSourceService.importCandidates('gmgn', items);
    } catch (err) {
      this.logger.error(`GMGN import failed: ${(err as Error).message}`);
      return [];
    }
  }

  async importFromBirdeye(
    trendingTokenAddresses?: string[],
  ): Promise<SmartWalletCandidate[]> {
    if (!this.birdeyeClient) {
      this.logger.debug('Birdeye client not configured, skipping');
      return [];
    }
    try {
      const tokenAddrs = trendingTokenAddresses ?? [];
      const items = await this.birdeyeClient.fetchTopSmartWallets(tokenAddrs);
      if (items.length === 0) return [];
      return this.smartWalletSourceService.importCandidates('birdeye', items);
    } catch (err) {
      this.logger.error(`Birdeye import failed: ${(err as Error).message}`);
      return [];
    }
  }

  async importFromCielo(): Promise<SmartWalletCandidate[]> {
    if (!this.cieloClient) {
      this.logger.debug('Cielo client not configured, skipping');
      return [];
    }
    try {
      const items = await this.cieloClient.fetchTopSmartWallets();
      if (items.length === 0) return [];
      return this.smartWalletSourceService.importCandidates('cielo', items);
    } catch (err) {
      this.logger.error(`Cielo import failed: ${(err as Error).message}`);
      return [];
    }
  }

  async importFromChainFM(): Promise<SmartWalletCandidate[]> {
    if (!this.chainfmClient) {
      this.logger.debug('ChainFM client not configured, skipping');
      return [];
    }
    try {
      const items = await this.chainfmClient.fetchTopSmartWallets();
      if (items.length === 0) return [];
      return this.smartWalletSourceService.importCandidates('chainfm', items);
    } catch (err) {
      this.logger.error(`ChainFM import failed: ${(err as Error).message}`);
      return [];
    }
  }

  // ── Manual / CSV Imports (preserved) ────────────────────────────────

  async importFromSource(
    sourceType: Exclude<SmartWalletSourceType, 'onchain_discovery'>,
    items: ImportWalletCandidateInput[],
  ): Promise<SmartWalletCandidate[]> {
    const candidates = await this.smartWalletSourceService.importCandidates(
      sourceType,
      items,
    );
    this.logger.log(
      `Imported ${candidates.length} external smart wallet candidates from ${sourceType}`,
    );
    return candidates;
  }

  async importCsvRows(
    sourceType: Exclude<SmartWalletSourceType, 'onchain_discovery'>,
    rows: Array<Record<string, any>>,
  ): Promise<SmartWalletCandidate[]> {
    const items: ImportWalletCandidateInput[] = rows
      .map((row) => ({
        address: String(row.address ?? '').trim(),
        name: row.name ? String(row.name) : undefined,
        sourceLabel: row.sourceLabel ? String(row.sourceLabel) : undefined,
        notes: row.notes ? String(row.notes) : undefined,
        isSystemMonitored: row.isSystemMonitored !== false,
        metrics: {
          pnl30d: this.toNumber(row.pnl30d),
          winRate30d: this.toNumber(row.winRate30d),
          avgHoldTime: this.toNumber(row.avgHoldTime),
          tradeCount30d: this.toNumber(row.tradeCount30d),
          avgPositionSize: this.toNumber(row.avgPositionSize),
          maxDrawdown: this.toNumber(row.maxDrawdown),
          rugPullCount: this.toNumber(row.rugPullCount),
          bundleCount: this.toNumber(row.bundleCount),
        },
        rawData: row,
      }))
      .filter((item) => item.address.length > 0);

    return this.importFromSource(sourceType, items);
  }

  private toNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
