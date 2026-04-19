import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ImportWalletCandidateInput } from '../smart-wallet-source.service';

const CIELO_BASE_URL = 'https://feed-api.cielo.finance/api/v1';

export interface CieloClientConfig {
  apiKey: string;
}

interface CieloTrendingToken {
  token_address: string;
  symbol: string;
  name: string;
  chain: string;
  unique_wallets?: number;
  transactions?: number;
  volume_24h?: number;
  market_cap?: number;
  price_change?: number;
}

interface CieloWalletStats {
  wallet_address: string;
  pnl_usd?: number;
  total_trades?: number;
  win_rate?: number;
  avg_trade_size?: number;
}

export class CieloClient {
  private readonly logger = new Logger(CieloClient.name);
  private readonly instance: AxiosInstance;

  constructor(config: CieloClientConfig) {
    this.instance = axios.create({
      baseURL: CIELO_BASE_URL,
      timeout: 30000,
      headers: {
        accept: 'application/json',
        'X-API-KEY': config.apiKey,
      },
    });
  }

  async fetchTrendingTokens(
    chain: string = 'solana',
    interval: string = '1h',
    limit: number = 20,
  ): Promise<CieloTrendingToken[]> {
    try {
      const resp = await this.instance.get('/trending-tokens', {
        params: {
          chain,
          interval,
          limit,
          sort_by: 'unique_wallets_desc',
        },
      });
      return resp.data?.data ?? resp.data?.tokens ?? [];
    } catch (err) {
      this.logger.error(`Cielo trending-tokens failed: ${(err as Error).message}`);
      return [];
    }
  }

  async fetchWalletEnhancedStats(
    walletAddress: string,
  ): Promise<CieloWalletStats | null> {
    try {
      const resp = await this.instance.get(
        `/wallets/${walletAddress}/enhanced-stats`,
        { params: { chains: 'solana' } },
      );
      return resp.data?.data ?? null;
    } catch (err) {
      this.logger.warn(`Cielo enhanced stats failed for ${walletAddress}: ${(err as Error).message}`);
      return null;
    }
  }

  async fetchTrackedWallets(): Promise<ImportWalletCandidateInput[]> {
    try {
      const resp = await this.instance.get('/tracked-wallets', {
        params: { chains: 'solana' },
      });
      const wallets = resp.data?.data ?? [];
      return wallets.map((w: any) => ({
        address: w.address ?? w.wallet_address,
        name: w.label ?? w.name,
        sourceLabel: 'cielo_tracked',
        isSystemMonitored: true,
        rawData: w,
      }));
    } catch (err) {
      this.logger.error(`Cielo tracked-wallets failed: ${(err as Error).message}`);
      return [];
    }
  }

  async fetchTopSmartWallets(): Promise<ImportWalletCandidateInput[]> {
    const results: ImportWalletCandidateInput[] = [];

    const trackedWallets = await this.fetchTrackedWallets();
    results.push(...trackedWallets);

    const trendingTokens = await this.fetchTrendingTokens('solana', '1h', 10);
    for (const token of trendingTokens) {
      results.push({
        address: token.token_address,
        name: `Cielo-Trending-${token.symbol}`,
        sourceLabel: 'cielo_trending_token',
        isSystemMonitored: false,
        rawData: token as unknown as Record<string, any>,
      });
    }

    return this.deduplicateByAddress(results);
  }

  private deduplicateByAddress(items: ImportWalletCandidateInput[]): ImportWalletCandidateInput[] {
    const seen = new Map<string, ImportWalletCandidateInput>();
    for (const item of items) {
      if (item.address && !seen.has(item.address)) {
        seen.set(item.address, item);
      }
    }
    return Array.from(seen.values());
  }
}
