import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { filterAssets, sortAssets, useAssetsStore, type Asset } from "./assets";

const mk = (over: Partial<Asset> = {}): Asset => ({
  token: null,
  chainId: 1,
  symbol: "ETH",
  decimals: 18,
  balanceSmallest: "0",
  ...over,
});

describe("sortAssets", () => {
  it("native token wins over ERC-20 regardless of symbol order", () => {
    const xs = [
      mk({ token: "0x" + "1".repeat(40), symbol: "AAA" }),
      mk({ token: null, symbol: "ZZZ" }),
    ];
    expect(sortAssets(xs).map((a) => a.symbol)).toEqual(["ZZZ", "AAA"]);
  });
  it("alphabetic among ERC-20s", () => {
    const xs = [
      mk({ token: "0x1", symbol: "USDC" }),
      mk({ token: "0x2", symbol: "DAI" }),
      mk({ token: "0x3", symbol: "WBTC" }),
    ];
    expect(sortAssets(xs).map((a) => a.symbol)).toEqual(["DAI", "USDC", "WBTC"]);
  });
  it("does not mutate input", () => {
    const xs = [mk({ symbol: "B" }), mk({ symbol: "A" })];
    const snapshot = xs.map((a) => a.symbol);
    sortAssets(xs);
    expect(xs.map((a) => a.symbol)).toEqual(snapshot);
  });
});

describe("filterAssets", () => {
  const xs = [
    mk({ chainId: 1, symbol: "ETH" }),
    mk({ chainId: 1, symbol: "USDC", token: "0x1" }),
    mk({ chainId: 137, symbol: "USDC", token: "0x2" }),
  ];
  it("filters by chain", () => {
    expect(filterAssets(xs, 1, "").length).toBe(2);
    expect(filterAssets(xs, 137, "").length).toBe(1);
  });
  it("filters by symbol substring, case-insensitive", () => {
    expect(filterAssets(xs, 1, "usd").length).toBe(1);
    expect(filterAssets(xs, 1, "ETH").length).toBe(1);
  });
  it("empty query matches everything on that chain", () => {
    expect(filterAssets(xs, 1, "   ").length).toBe(2);
  });
});

describe("useAssetsStore", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("load sets `all` + tracks loading/error", async () => {
    const store = useAssetsStore();
    const provider = {
      fetchAll: async () => [mk({ symbol: "ETH", balanceSmallest: "100" })],
    };
    const p = store.load(provider, "0xabc");
    expect(store.loading).toBe(true);
    await p;
    expect(store.loading).toBe(false);
    expect(store.all.length).toBe(1);
    expect(store.error).toBeNull();
  });

  it("load captures errors", async () => {
    const store = useAssetsStore();
    const provider = {
      fetchAll: async () => {
        throw new Error("indexer down");
      },
    };
    await store.load(provider, "0xabc");
    expect(store.loading).toBe(false);
    expect(store.error).toBe("indexer down");
    expect(store.all).toEqual([]);
  });

  it("totalsBySymbol sums across chains with BigInt precision", () => {
    const store = useAssetsStore();
    store.$patch({
      all: [
        mk({ symbol: "USDC", balanceSmallest: "1000000" }),
        mk({ symbol: "USDC", balanceSmallest: "2500000", chainId: 137 }),
        mk({ symbol: "ETH", balanceSmallest: "1000000000000000000" }),
      ],
    });
    const t = store.totalsBySymbol;
    expect(t["USDC"]).toBe("3500000");
    expect(t["ETH"]).toBe("1000000000000000000");
  });
});
