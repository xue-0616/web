import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ImportWalletCandidateInput } from '../smart-wallet-source.service';

const CHAIN_FM_URL = 'https://chain.fm/api/trpc';

export interface ChainFMSmartWalletConfig {
  channelIds: string[];
}

interface ChainFMAddress {
  address: string;
  name?: string;
}

export class ChainFMSmartWalletClient {
  private readonly logger = new Logger(ChainFMSmartWalletClient.name);
  private readonly instance: AxiosInstance;
  private readonly channelIds: string[];

  constructor(config: ChainFMSmartWalletConfig) {
    this.channelIds = config.channelIds;
    this.instance = axios.create({
      baseURL: CHAIN_FM_URL,
      timeout: 30000,
    });
  }

  async fetchTopSmartWallets(): Promise<ImportWalletCandidateInput[]> {
    const allCandidates: ImportWalletCandidateInput[] = [];

    for (const channelId of this.channelIds) {
      try {
        const addresses = await this.fetchChannelAddresses(channelId);
        for (const addr of addresses) {
          allCandidates.push({
            address: addr.address,
            name: addr.name || undefined,
            sourceLabel: `chainfm_channel_${channelId}`,
            isSystemMonitored: true,
            rawData: { channelId, ...addr },
          });
        }
      } catch (err) {
        this.logger.warn(`ChainFM channel ${channelId} fetch failed: ${(err as Error).message}`);
      }
    }

    return this.deduplicateByAddress(allCandidates);
  }

  private async fetchChannelAddresses(channelId: string): Promise<ChainFMAddress[]> {
    const resp = await this.instance.get(
      `/channel.get?batch=1&input={"0":{"json":"${channelId}"}}`,
    );
    if (resp.status !== 200) {
      throw new Error(`ChainFM returned status ${resp.status}`);
    }

    const data = resp.data;
    const json = this.extractJson(data);
    if (!json || !Array.isArray(json.addresses)) {
      this.logger.warn(`ChainFM channel ${channelId} returned invalid data`);
      return [];
    }

    return json.addresses.map((a: any) => ({
      address: a.address,
      name: a.name || undefined,
    }));
  }

  private extractJson(data: any): any {
    if (Array.isArray(data) && data[0]?.result?.data?.json) {
      return data[0].result.data.json;
    }
    if (data?.result?.data?.json) {
      return data.result.data.json;
    }
    return null;
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
