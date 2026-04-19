import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * SocialSignalService — aggregates off-chain social intelligence to complement
 * the on-chain Copy Trade Filter.
 *
 * Motivation: Solidus Labs 2025 report — 98.6% of pump.fun tokens are rug pulls
 * or pump-and-dumps. Pure on-chain checks (RugCheck + Token-2022 extensions +
 * liquidity) filter the most obvious scams but can't detect:
 *   - Coordinated narrative campaigns (KOL shilling before dump)
 *   - Social-driven momentum plays
 *   - Real organic communities
 *
 * Design: PULL-based enrichment from 3rd-party APIs with Redis cache.
 * Each signal is cached for SIGNAL_TTL_SECS so we don't hammer APIs at
 * trade-decision time (latency budget for CopyTradeFilter is ~50-200ms).
 *
 * Upstream providers (plug-in, via env vars):
 *   - TWITTER_STREAM_API_URL / TWITTER_STREAM_API_KEY  (Apify / Nitter proxy)
 *   - LUNARCRUSH_API_KEY                                 (LunarCrush v2)
 *   - TELEGRAM_MONITOR_URL                               (self-hosted tg-scraper)
 *
 * If no provider is configured, `getTokenSignal()` returns `null` and the
 * CopyTradeFilter layer degrades gracefully.
 */

export interface TokenSocialSignal {
  tokenMint: string;
  /** Tweets/posts per hour mentioning this mint or ticker */
  tweetsPerHour: number;
  /** Weighted KOL influence score (0-100, where KOL follower count × engagement is weighted) */
  kolInfluenceScore: number;
  /** Sentiment ratio (0-1, 1.0 = fully positive) */
  sentimentRatio: number;
  /** Named KOLs who posted about the token in last 24h */
  kolMentions: string[];
  /** Whether this token is seeing a coordinated campaign pattern (suspicious) */
  isCoordinatedCampaign: boolean;
  /** Composite score 0-100: higher = stronger organic social signal */
  compositeScore: number;
  /** When the signal was last refreshed (epoch ms) */
  refreshedAtMs: number;
}

const CACHE_PREFIX = (env: string) => `${env}:DEXAUTO:SOCIAL_SIGNAL:`;
const SIGNAL_TTL_SECS = 600; // 10 minutes

/** Block-list of obvious KOL shilling patterns: same token in >N tweets within X minutes by accounts with similar age/follower counts */
const COORDINATED_CAMPAIGN_WINDOW_MIN = 30;
const COORDINATED_CAMPAIGN_MIN_ACCOUNTS = 5;

@Injectable()
export class SocialSignalService {
  private readonly logger = new Logger(SocialSignalService.name);
  private readonly cachePrefix: string;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    const env = this.configService.get<string>('NODE_ENV', 'DEV').toUpperCase();
    this.cachePrefix = CACHE_PREFIX(env);
  }

  /**
   * Fetch the social signal for a token. Returns `null` if no provider is
   * configured OR the cache is empty AND the API call fails.
   *
   * Hot path: ~1ms when cached, ~200-500ms on refresh.
   */
  async getTokenSignal(tokenMint: string): Promise<TokenSocialSignal | null> {
    const cacheKey = this.cacheKey(tokenMint);
    const cached = await this.redisClient.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // fall through to refresh
      }
    }
    return this.refreshTokenSignal(tokenMint);
  }

  /**
   * Force refresh from upstream providers. Handles provider fan-out and fusion.
   */
  async refreshTokenSignal(tokenMint: string): Promise<TokenSocialSignal | null> {
    const providers = this.resolveProviders();
    if (providers.length === 0) {
      // No provider configured — log once per boot via `debug` and return null so
      // the CopyTradeFilter layer treats this as "neutral" (not a rejection).
      return null;
    }

    const results = await Promise.allSettled(
      providers.map((p) => this.callProvider(p, tokenMint)),
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<TokenSocialSignal> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value);

    if (successful.length === 0) {
      return null;
    }

    // Simple fusion: average the scalar signals across providers.
    const fused = this.fuseSignals(tokenMint, successful);
    await this.redisClient.setex(
      this.cacheKey(tokenMint),
      SIGNAL_TTL_SECS,
      JSON.stringify(fused),
    );
    return fused;
  }

  /**
   * Composite score thresholds for CopyTradeFilter integration:
   *   - score < 20: weak/absent social signal, only on-chain decision
   *   - score 20-50: moderate organic chatter, can proceed normally
   *   - score >= 50: strong signal, can relax some on-chain thresholds
   *   - isCoordinatedCampaign=true: HARD REJECT regardless of score
   */
  isCoordinatedCampaign(signal: TokenSocialSignal | null): boolean {
    return signal?.isCoordinatedCampaign === true;
  }

  /**
   * Decide whether the social signal is strong enough to CONTRIBUTE positively
   * to the copy-trade decision. Returns 0-1 confidence multiplier.
   * Meant to be multiplied into FundAllocator's tradeAmount.
   */
  computeConfidenceMultiplier(signal: TokenSocialSignal | null): number {
    if (!signal) return 1.0; // neutral — don't penalize when no data
    if (signal.isCoordinatedCampaign) return 0;
    if (signal.compositeScore < 20) return 0.8;   // weak signal → slightly reduce
    if (signal.compositeScore < 50) return 1.0;   // normal
    return Math.min(1.3, 1.0 + (signal.compositeScore - 50) / 100); // strong → up to +30%
  }

  // ── Provider Integration ────────────────────────────────────────────

  private resolveProviders(): Array<'twitter' | 'lunarcrush' | 'telegram'> {
    const providers: Array<'twitter' | 'lunarcrush' | 'telegram'> = [];
    if (this.configService.get('TWITTER_STREAM_API_URL')) providers.push('twitter');
    if (this.configService.get('LUNARCRUSH_API_KEY')) providers.push('lunarcrush');
    if (this.configService.get('TELEGRAM_MONITOR_URL')) providers.push('telegram');
    return providers;
  }

  private async callProvider(
    provider: 'twitter' | 'lunarcrush' | 'telegram',
    tokenMint: string,
  ): Promise<TokenSocialSignal | null> {
    try {
      switch (provider) {
        case 'twitter':
          return await this.callTwitterProvider(tokenMint);
        case 'lunarcrush':
          return await this.callLunarCrushProvider(tokenMint);
        case 'telegram':
          return await this.callTelegramProvider(tokenMint);
      }
    } catch (err) {
      this.logger.warn(`${provider} provider call failed for ${tokenMint.slice(0, 8)}...: ${(err as Error)}`);
      return null;
    }
  }

  private async callTwitterProvider(tokenMint: string): Promise<TokenSocialSignal | null> {
    const url = this.configService.getOrThrow<string>('TWITTER_STREAM_API_URL');
    const apiKey = this.configService.get<string>('TWITTER_STREAM_API_KEY', '');
    const resp = await fetch(`${url}/token/${tokenMint}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;

    const tweetsPerHour = Number(data?.tweetsPerHour ?? 0);
    const kolInfluenceScore = Number(data?.kolInfluenceScore ?? 0);
    const sentimentRatio = Math.max(0, Math.min(1, Number(data?.sentimentRatio ?? 0.5)));
    const kolMentions: string[] = Array.isArray(data?.kolMentions) ? data.kolMentions : [];
    const recentAccountCount = Number(data?.recentPostingAccountCount ?? 0);
    const accountAgeVariance = Number(data?.accountAgeStdDev ?? Infinity);

    // Coordinated campaign: many accounts with similar age posting in a short window
    const isCoordinatedCampaign =
      recentAccountCount >= COORDINATED_CAMPAIGN_MIN_ACCOUNTS &&
      accountAgeVariance < 3 &&
      (data?.windowMinutes ?? 60) <= COORDINATED_CAMPAIGN_WINDOW_MIN;

    return {
      tokenMint,
      tweetsPerHour,
      kolInfluenceScore,
      sentimentRatio,
      kolMentions,
      isCoordinatedCampaign,
      compositeScore: this.computeComposite({
        tweetsPerHour,
        kolInfluenceScore,
        sentimentRatio,
        kolMentions,
        isCoordinatedCampaign,
      }),
      refreshedAtMs: Date.now(),
    };
  }

  private async callLunarCrushProvider(tokenMint: string): Promise<TokenSocialSignal | null> {
    // LunarCrush v2 API endpoint — adapt to your actual endpoint path.
    const apiKey = this.configService.getOrThrow<string>('LUNARCRUSH_API_KEY');
    const url = `https://lunarcrush.com/api4/public/coins/${tokenMint}/v1`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    const d = data?.data ?? {};
    const tweetsPerHour = Number(d?.social_volume ?? 0) / 24; // social_volume is 24h total
    const sentimentRatio = Math.max(0, Math.min(1, Number(d?.sentiment ?? 50) / 100));

    return {
      tokenMint,
      tweetsPerHour,
      kolInfluenceScore: Number(d?.social_score ?? 0),
      sentimentRatio,
      kolMentions: [],
      isCoordinatedCampaign: false, // LunarCrush doesn't expose this; rely on twitter provider
      compositeScore: this.computeComposite({
        tweetsPerHour,
        kolInfluenceScore: Number(d?.social_score ?? 0),
        sentimentRatio,
        kolMentions: [],
        isCoordinatedCampaign: false,
      }),
      refreshedAtMs: Date.now(),
    };
  }

  private async callTelegramProvider(tokenMint: string): Promise<TokenSocialSignal | null> {
    const url = this.configService.getOrThrow<string>('TELEGRAM_MONITOR_URL');
    const resp = await fetch(`${url}/token/${tokenMint}`, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    const mentionsPerHour = Number(data?.mentionsPerHour ?? 0);

    return {
      tokenMint,
      tweetsPerHour: mentionsPerHour, // unified field
      kolInfluenceScore: Number(data?.groupInfluenceScore ?? 0),
      sentimentRatio: Math.max(0, Math.min(1, Number(data?.sentimentRatio ?? 0.5))),
      kolMentions: Array.isArray(data?.channelMentions) ? data.channelMentions : [],
      isCoordinatedCampaign: Boolean(data?.isCoordinatedShilling),
      compositeScore: this.computeComposite({
        tweetsPerHour: mentionsPerHour,
        kolInfluenceScore: Number(data?.groupInfluenceScore ?? 0),
        sentimentRatio: Math.max(0, Math.min(1, Number(data?.sentimentRatio ?? 0.5))),
        kolMentions: data?.channelMentions ?? [],
        isCoordinatedCampaign: Boolean(data?.isCoordinatedShilling),
      }),
      refreshedAtMs: Date.now(),
    };
  }

  private fuseSignals(tokenMint: string, signals: TokenSocialSignal[]): TokenSocialSignal {
    const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
    const fused: TokenSocialSignal = {
      tokenMint,
      tweetsPerHour: avg(signals.map((s) => s.tweetsPerHour)),
      kolInfluenceScore: avg(signals.map((s) => s.kolInfluenceScore)),
      sentimentRatio: avg(signals.map((s) => s.sentimentRatio)),
      kolMentions: Array.from(new Set(signals.flatMap((s) => s.kolMentions))),
      isCoordinatedCampaign: signals.some((s) => s.isCoordinatedCampaign),
      compositeScore: avg(signals.map((s) => s.compositeScore)),
      refreshedAtMs: Date.now(),
    };
    return fused;
  }

  /**
   * Composite score formula (0-100):
   *   30% tweet volume (log-scaled)
   *   30% KOL influence
   *   20% sentiment (only counts when positive)
   *   20% KOL breadth (number of unique KOLs mentioning)
   * Hard zero if coordinated campaign detected.
   */
  private computeComposite(input: {
    tweetsPerHour: number;
    kolInfluenceScore: number;
    sentimentRatio: number;
    kolMentions: string[];
    isCoordinatedCampaign: boolean;
  }): number {
    if (input.isCoordinatedCampaign) return 0;

    const volume = Math.min(30, Math.log10(1 + input.tweetsPerHour) * 15);
    const kolInfluence = Math.min(30, input.kolInfluenceScore * 0.3);
    const sentiment = input.sentimentRatio >= 0.5
      ? (input.sentimentRatio - 0.5) * 40
      : 0;
    const breadth = Math.min(20, input.kolMentions.length * 2);

    return Math.round(volume + kolInfluence + sentiment + breadth);
  }

  private cacheKey(tokenMint: string): string {
    return `${this.cachePrefix}${tokenMint}`;
  }
}
