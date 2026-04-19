/**
 * Strategy catalog. Each template advertises a stable `id` the backend
 * `automatic-strategy-executor` recognises — the UI just renders the
 * metadata and posts a configuration blob on deploy.
 */
export interface StrategyTemplate {
  id: "grid" | "dca" | "sniper" | "copy" | "sandwich" | "limit";
  name: string;
  blurb: string;
  icon: string;
  risk: "low" | "medium" | "high";
  params: StrategyParam[];
}

export interface StrategyParam {
  key: string;
  label: string;
  kind: "number" | "pair" | "address" | "duration";
  placeholder?: string;
  default?: string;
  hint?: string;
}

export const STRATEGIES: StrategyTemplate[] = [
  {
    id: "grid",
    name: "Grid trading",
    blurb: "Buy-low / sell-high across a price range. Good for sideways markets.",
    icon: "▦",
    risk: "low",
    params: [
      { key: "pair", label: "Pair", kind: "pair", placeholder: "SOL/USDC" },
      { key: "min", label: "Min price", kind: "number", placeholder: "150" },
      { key: "max", label: "Max price", kind: "number", placeholder: "220" },
      { key: "gridCount", label: "Grid count", kind: "number", default: "10" },
      { key: "totalUsd", label: "Capital (USD)", kind: "number", placeholder: "1000" },
    ],
  },
  {
    id: "dca",
    name: "Dollar-cost average",
    blurb: "Buy a fixed USD amount on a schedule. Set-and-forget accumulation.",
    icon: "➕",
    risk: "low",
    params: [
      { key: "pair", label: "Pair", kind: "pair", placeholder: "SOL/USDC" },
      { key: "amountUsd", label: "Per-buy USD", kind: "number", placeholder: "50" },
      { key: "interval", label: "Interval", kind: "duration", default: "1d" },
    ],
  },
  {
    id: "sniper",
    name: "Launch sniper",
    blurb: "Auto-buy tokens the moment they list on Raydium / Pump.fun graduation.",
    icon: "🎯",
    risk: "high",
    params: [
      { key: "maxPriceSol", label: "Max price (SOL)", kind: "number", placeholder: "0.001" },
      { key: "buySize", label: "Buy size (SOL)", kind: "number", placeholder: "0.1" },
      { key: "rugGuardBps", label: "Rug-guard BP cap", kind: "number", default: "500", hint: "Auto-exit if LP pulls >5%." },
    ],
  },
  {
    id: "copy",
    name: "Copy trader",
    blurb: "Mirror the swaps of a chosen wallet in real time.",
    icon: "👤",
    risk: "medium",
    params: [
      { key: "target", label: "Target wallet", kind: "address", placeholder: "base58 pubkey" },
      { key: "sizeMultiplier", label: "Size multiplier", kind: "number", default: "0.1" },
    ],
  },
  {
    id: "limit",
    name: "Limit order",
    blurb: "Execute at (or better than) a set price once the market crosses it.",
    icon: "⇅",
    risk: "low",
    params: [
      { key: "pair", label: "Pair", kind: "pair", placeholder: "SOL/USDC" },
      { key: "side", label: "Side", kind: "pair", placeholder: "buy or sell" },
      { key: "price", label: "Limit price", kind: "number" },
      { key: "size", label: "Size", kind: "number" },
    ],
  },
  {
    id: "sandwich",
    name: "MEV defense",
    blurb: "Detect sandwich attempts on your pending tx and reroute to private mempool.",
    icon: "🛡️",
    risk: "medium",
    params: [
      { key: "protectBps", label: "Min profit to protect (bps)", kind: "number", default: "20" },
    ],
  },
];

export const RISK_COLOR = {
  low: "var(--gain)",
  medium: "var(--warn)",
  high: "var(--loss)",
} as const;
