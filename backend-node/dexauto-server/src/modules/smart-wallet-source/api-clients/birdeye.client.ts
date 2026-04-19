import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ImportWalletCandidateInput } from '../smart-wallet-source.service';

const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';

export interface BirdeyeClientConfig {
  apiKey: string;
}

interface BirdeyeTopTrader {
  owner: string;
  tokenAddress: string;
  trade: number;
  tradeBuy: number;
  tradeSell: number;
  volume: number;
  volumeBuy: number;
  volumeSell: number;
  tags?: string[];
}

interface BirdeyeWalletPnl {
  address: string;
  total: {
    pnl: number;
    totalTrade: number;
    totalBuy: number;
    totalSell: number;
  };
}

export class BirdeyeClient {
  private readonly logger = new Logger(BirdeyeClient.name);
  private readonly instance: AxiosInstance;

  constructor(config: BirdeyeClientConfig) {
    this.instance = axios.create({
      baseURL: BIRDEYE_BASE_URL,
      timeout: 30000,
      headers: {
        accept: 'application/json',
        'X-API-KEY': config.apiKey,
        'x-chain': 'solana',
      },
    });
  }

  async fetchTopTradersForToken(
    tokenAddress: string,
    timeFrame: string = '24h',
  ): Promise<ImportWalletCandidateInput[]> {
    try {
      const resp = await this.instance.get('/defi/v2/tokens/top_traders', {
        params: {
          address: tokenAddress,
          sort_by: 'volume',
          sort_type: 'desc',
          time_frame: timeFrame,
          offset: 0,
          limit: 10,
        },
      });
      if (!resp.data?.success || !resp.data?.data?.items) {
        this.logger.warn(`Birdeye top_traders returned unexpected response for ${tokenAddress}`);
        return [];
      }

      const traders: BirdeyeTopTrader[] = resp.data.data.items;
      return traders
        .filter((t) => !t.tags?.includes('arbitrage-bot'))
        .map((t) => this.mapTraderToCandidate(t));
    } catch (err) {
      this.logger.error(`Birdeye top_traders failed for ${tokenAddress}: ${(err as Error).message}`);
      return [];
    }
  }

  async fetchWalletPnl(walletAddress: string): Promise<BirdeyeWalletPnl | null> {
    try {
      const resp = await this.instance.get('/wallet/v2/pnl', {
        params: { wallet: walletAddress },
      });
      if (!resp.data?.success) return null;
      return resp.data.data;
    } catch (err) {
      this.logger.warn(`Birdeye wallet PnL failed for ${walletAddress}: ${(err as Error).message}`);
      return null;
    }
  }

  async fetchTopSmartWallets(
    trendingTokenAddresses: string[],
  ): Promise<ImportWalletCandidateInput[]> {
    const allTraders: ImportWalletCandidateInput[] = [];

    for (const tokenAddr of trendingTokenAddresses.slice(0, 5)) {
      try {
        const traders = await this.fetchTopTradersForToken(tokenAddr);
        allTraders.push(...traders);
        await this.sleep(200);
      } catch (err) {
        this.logger.warn(`Birdeye fetch failed for token ${tokenAddr}: ${(err as Error).message}`);
      }
    }

    return this.deduplicateByAddress(allTraders);
  }

  private mapTraderToCandidate(trader: BirdeyeTopTrader): ImportWalletCandidateInput {
    const totalTrades = trader.trade ?? 0;
    const winRate = totalTrades > 0 ? trader.tradeBuy / totalTrades : 0.5;

    return {
      address: trader.owner,
      sourceLabel: 'birdeye_top_trader',
      isSystemMonitored: true,
      metrics: {
        tradeCount30d: totalTrades,
        winRate30d: winRate,
        avgPositionSize: totalTrades > 0 ? trader.volume / totalTrades : undefined,
      },
      rawData: trader as unknown as Record<string, any>,
    };
  }

  private deduplicateByAddress(items: ImportWalletCandidateInput[]): ImportWalletCandidateInput[] {
    const seen = new Map<string, ImportWalletCandidateInput>();
    for (const item of items) {
      if (!seen.has(item.address)) {
        seen.set(item.address, item);
      }
    }
    return Array.from(seen.values());
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
