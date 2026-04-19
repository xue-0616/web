/**
 * Payment request URL format.
 *
 * URL shape (UniPass pay:// deep-link, mirrored on `?pay=...`):
 *
 *   pay://v1/?to=0xABC...&chain=1&token=0xUSDC&amount=1500000&memo=Invoice+7
 *
 * Fields:
 *   * `to`      — EVM address, 20 bytes, 0x-prefixed
 *   * `chain`   — numeric chain id (1 = Ethereum, 56 = BNB, 42161 = Arbitrum…)
 *   * `token`   — ERC-20 address; omitted ⇒ native gas token (ETH/BNB)
 *   * `amount`  — smallest-unit integer as a decimal string
 *                 (e.g. 1500000 for 1.5 USDC at 6 decimals)
 *   * `memo`    — optional human-readable note (URL-encoded)
 */

export interface PaymentRequest {
  to: string;
  chain: number;
  token: string | null;
  amount: string;
  memo: string | null;
}

export type ParsePaymentResult =
  | { ok: true; value: PaymentRequest }
  | { ok: false; error: string };

export function parsePayment(raw: string): ParsePaymentResult {
  if (!raw) return { ok: false, error: "empty" };
  // Accept both pay://v1/?... and ?... (post-strip query from `pay=`).
  const idx = raw.indexOf("?");
  const query = idx >= 0 ? raw.slice(idx + 1) : raw;
  const params = new URLSearchParams(query);

  const to = params.get("to") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return { ok: false, error: "to_invalid" };
  }
  const chainStr = params.get("chain") ?? "";
  const chain = Number.parseInt(chainStr, 10);
  if (!Number.isFinite(chain) || chain <= 0) {
    return { ok: false, error: "chain_invalid" };
  }
  const amount = params.get("amount") ?? "";
  if (!/^\d+$/.test(amount) || amount === "0") {
    return { ok: false, error: "amount_invalid" };
  }
  const token = params.get("token");
  if (token !== null && !/^0x[0-9a-fA-F]{40}$/.test(token)) {
    return { ok: false, error: "token_invalid" };
  }
  const memo = params.get("memo");
  return {
    ok: true,
    value: {
      to: to.toLowerCase(),
      chain,
      token: token ? token.toLowerCase() : null,
      amount,
      memo: memo && memo.length > 0 ? memo : null,
    },
  };
}

/** Human-readable chain name, or the raw id for unknown chains. */
export function chainLabel(id: number): string {
  const map: Record<number, string> = {
    1: "Ethereum",
    10: "Optimism",
    56: "BNB Chain",
    137: "Polygon",
    42161: "Arbitrum",
    8453: "Base",
  };
  return map[id] ?? `Chain ${id}`;
}

/**
 * Format a smallest-unit integer string with a given decimal scale and
 * symbol. Returns e.g. `1.5 USDC` for `("1500000", 6, "USDC")`.
 *
 * Uses BigInt for precision — never floats (which would silently round
 * on amounts past 2^53).
 */
export function formatAmount(amountSmallest: string, decimals: number, symbol: string): string {
  if (!/^\d+$/.test(amountSmallest)) return `${amountSmallest} ${symbol}`;
  if (decimals === 0) return `${amountSmallest} ${symbol}`;
  const bi = BigInt(amountSmallest);
  const divisor = 10n ** BigInt(decimals);
  const whole = bi / divisor;
  const frac = bi % divisor;
  if (frac === 0n) return `${whole} ${symbol}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} ${symbol}`;
}

/** Truncate an EVM address for UI display: `0x1234...abcd`. */
export function shortAddress(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
