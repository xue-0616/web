import { defineStore } from "pinia";

export interface Asset {
  /** Lowercase 0x-hex. `null` for native token. */
  token: string | null;
  chainId: number;
  symbol: string;
  decimals: number;
  balanceSmallest: string;
}

export interface AssetsProvider {
  fetchAll(address: string): Promise<Asset[]>;
}

/**
 * Sort helper exposed at module scope for unit-testability:
 * native token first (token === null), then alphabetic by symbol.
 */
export function sortAssets(xs: Asset[]): Asset[] {
  return xs.slice().sort((a, b) => {
    if (a.token === null && b.token !== null) return -1;
    if (a.token !== null && b.token === null) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

/**
 * Filter by chain and optionally a symbol substring (case-insensitive).
 */
export function filterAssets(xs: Asset[], chainId: number, query: string): Asset[] {
  const q = query.trim().toLowerCase();
  return xs.filter((a) => a.chainId === chainId && (!q || a.symbol.toLowerCase().includes(q)));
}

export const useAssetsStore = defineStore("assets", {
  state: () => ({
    all: [] as Asset[],
    loading: false as boolean,
    error: null as string | null,
  }),
  getters: {
    totalsBySymbol(): Record<string, string> {
      const out: Record<string, bigint> = {};
      for (const a of this.all) {
        const prev = out[a.symbol] ?? 0n;
        out[a.symbol] = prev + BigInt(a.balanceSmallest);
      }
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.toString()]));
    },
  },
  actions: {
    async load(provider: AssetsProvider, address: string) {
      this.loading = true;
      this.error = null;
      try {
        this.all = await provider.fetchAll(address);
      } catch (e) {
        this.error = e instanceof Error ? e.message : "unknown";
      } finally {
        this.loading = false;
      }
    },
  },
});
