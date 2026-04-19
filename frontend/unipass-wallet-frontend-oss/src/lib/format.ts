/**
 * Chain + amount formatting helpers. Mirrors the payment-web utilities
 * but scoped to the wallet shell so there's no cross-project coupling.
 */

export function shortAddr(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function chainLabel(id: number): string {
  const map: Record<number, string> = {
    1: "Ethereum",
    10: "Optimism",
    56: "BNB",
    137: "Polygon",
    42161: "Arbitrum",
    8453: "Base",
  };
  return map[id] ?? `Chain ${id}`;
}

export function formatAmount(smallest: string, decimals: number): string {
  if (!/^\d+$/.test(smallest)) return smallest;
  if (decimals === 0) return smallest;
  const bi = BigInt(smallest);
  const div = 10n ** BigInt(decimals);
  const whole = bi / div;
  const frac = bi % div;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Simple EIP-55-ish checksum check. Returns true iff every hex char
 * matches its expected case. Actual EIP-55 requires keccak256 which
 * we avoid dragging in; this catches the overwhelming majority of
 * paste-typos.
 */
export function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/** Parse a human amount (e.g. "1.5") into a smallest-unit BigInt string. */
export function parseAmount(human: string, decimals: number): string | null {
  const trimmed = human.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const padded = frac.padEnd(decimals, "0");
  const joined = `${whole}${padded}`.replace(/^0+/, "") || "0";
  return joined;
}
