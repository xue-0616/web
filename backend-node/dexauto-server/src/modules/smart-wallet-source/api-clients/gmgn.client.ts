import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { ImportWalletCandidateInput } from '../smart-wallet-source.service';

const GMGN_BASE_URL = 'https://gmgn.ai/api';
const GMGN_UNOFFICIAL_BASE_URL = 'https://gmgn.ai/defi/quotation';

export interface GmgnClientConfig {
  apiKey?: string;
  apiSecret?: string;
  useOfficialApi: boolean;
}

interface GmgnTopTrader {
  address: string;
  name?: string | null;
  twitter_username?: string | null;
  wallet_tag_v2?: string;
  tags?: string[];
  profit?: number;
  realized_profit?: number;
  unrealized_profit?: number;
  buy_tx_count_cur?: number;
  sell_tx_count_cur?: number;
  buy_volume_cur?: number;
  sell_volume_cur?: number;
  amount_percentage?: number;
  is_suspicious?: boolean;
}

interface GmgnRankToken {
  address: string;
  symbol: string;
  smart_degen_count?: number;
  renowned_count?: number;
  volume?: number;
  liquidity?: number;
  market_cap?: number;
  holder_count?: number;
}

export class GmgnClient {
  private readonly logger = new Logger(GmgnClient.name);
  private readonly officialInstance: AxiosInstance;
  private readonly unofficialInstance: AxiosInstance;
  private readonly config: GmgnClientConfig;

  constructor(config: GmgnClientConfig) {
    this.config = config;
    this.officialInstance = axios.create({
      baseURL: GMGN_BASE_URL,
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        ...(config.apiKey ? { 'X-API-KEY': config.apiKey } : {}),
      },
    });
    this.unofficialInstance = axios.create({
      baseURL: GMGN_UNOFFICIAL_BASE_URL,
      timeout: 30000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  }

  async fetchTopSmartWallets(): Promise<ImportWalletCandidateInput[]> {
    if (this.config.useOfficialApi && this.config.apiKey) {
      return this.fetchViaOfficialApi();
    }
    return this.fetchViaUnofficialApi();
  }

  private async fetchViaOfficialApi(): Promise<ImportWalletCandidateInput[]> {
    const results: ImportWalletCandidateInput[] = [];

    const hotTokens = await this.fetchTrendingTokens();
    for (const token of hotTokens.slice(0, 10)) {
      try {
        const traders = await this.fetchTokenTopTraders(token.address);
        for (const trader of traders) {
          if (trader.is_suspicious) continue;
          results.push(this.mapTraderToCandidate(trader, token.symbol));
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch traders for ${token.symbol}: ${(err as Error).message}`);
      }
    }

    return this.deduplicateByAddress(results);
  }

  private async fetchViaUnofficialApi(): Promise<ImportWalletCandidateInput[]> {
    try {
      const resp = await this.unofficialInstance.get(
        '/v1/rank/sol/swaps/24h',
        {
          params: {
            orderby: 'smartmoney',
            direction: 'desc',
            'filters[]': ['not_honeypot', 'renounced'],
          },
        },
      );
      if (resp.data?.code !== 0 || !resp.data?.data?.rank) {
        this.logger.warn(`GMGN unofficial API returned unexpected response`);
        return [];
      }

      const tokens: GmgnRankToken[] = resp.data.data.rank;
      return tokens
        .filter((t) => (t.smart_degen_count ?? 0) > 0 || (t.renowned_count ?? 0) > 0)
        .slice(0, 50)
        .map((t) => ({
          address: t.address,
          name: `GMGN-Hot-${t.symbol}`,
          sourceLabel: 'gmgn_trending',
          isSystemMonitored: false,
          rawData: t as unknown as Record<string, any>,
        }));
    } catch (err) {
      this.logger.error(`GMGN unofficial API failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchTrendingTokens(): Promise<GmgnRankToken[]> {
    const timestamp = Math.floor(Date.now() / 1000);
    const clientId = uuidv4();
    const resp = await this.officialInstance.get('/v1/market/rank', {
      params: {
        chain: 'sol',
        interval: '1h',
        limit: 20,
        order_by: 'smart_degen_count',
        direction: 'desc',
        timestamp,
        client_id: clientId,
      },
    });
    if (resp.data?.code !== 0) {
      throw new Error(`GMGN rank API error: ${resp.data?.message}`);
    }
    return resp.data.data.rank ?? [];
  }

  private async fetchTokenTopTraders(tokenAddress: string): Promise<GmgnTopTrader[]> {
    const timestamp = Math.floor(Date.now() / 1000);
    const clientId = uuidv4();
    const resp = await this.officialInstance.get('/v1/market/token_top_traders', {
      params: {
        chain: 'sol',
        address: tokenAddress,
        limit: 20,
        order_by: 'profit',
        direction: 'desc',
        tag: 'smart_degen',
        timestamp,
        client_id: clientId,
      },
    });
    if (resp.data?.code !== 0) {
      throw new Error(`GMGN top_traders API error: ${resp.data?.message}`);
    }
    return resp.data.data.list ?? [];
  }

  private mapTraderToCandidate(
    trader: GmgnTopTrader,
    tokenSymbol?: string,
  ): ImportWalletCandidateInput {
    const buyCount = trader.buy_tx_count_cur ?? 0;
    const sellCount = trader.sell_tx_count_cur ?? 0;
    const totalTrades = buyCount + sellCount;
    const winRate = totalTrades > 0 ? buyCount / totalTrades : 0.5;

    return {
      address: trader.address,
      name: trader.name ?? trader.twitter_username ?? undefined,
      sourceLabel: `gmgn_top_trader${tokenSymbol ? `_${tokenSymbol}` : ''}`,
      isSystemMonitored: true,
      metrics: {
        pnl30d: trader.realized_profit ?? trader.profit ?? 0,
        winRate30d: winRate,
        tradeCount30d: totalTrades,
        avgPositionSize: trader.buy_volume_cur
          ? trader.buy_volume_cur / Math.max(buyCount, 1)
          : undefined,
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
}
