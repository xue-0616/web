import { Logger } from '@nestjs/common';
import bs58 from 'bs58';

/**
 * Parsed DEX swap trade extracted from a Solana transaction.
 * Compatible with the existing AccountDexTrade interface used by
 * AutomaticStrategySyncerService.syncAccountDexTrades().
 */
export interface ParsedDexSwap {
  tx_id: string;
  trader: string;
  base_mint: string;
  quote_mint: string;
  block_time: string;
  base_amount: string;
  quote_amount: string;
  usd_value: string;
  /** 'buy' = trader acquired base_mint; 'sell' = trader disposed of base_mint */
  side: 'buy' | 'sell';
  /** Which DEX program processed the swap */
  dex: string;
}

// ── Known DEX program IDs ──────────────────────────────────────────────

/** Jupiter V2 aggregator */
const JUPITER_V6_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

/** Raydium AMM V4 */
const RAYDIUM_AMM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';

/** Raydium CLMM (concentrated liquidity) */
const RAYDIUM_CLMM = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';

/** Raydium CP-AMM (constant product V2) */
const RAYDIUM_CPAMM = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';

/** Pump.fun bonding curve */
const PUMP_FUN = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/** Orca Whirlpool */
const ORCA_WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';

/** Meteora DLMM */
const METEORA_DLMM = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

/** WSOL mint (native SOL wrapper) */
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

const DEX_PROGRAM_IDS = new Set([
  JUPITER_V6_PROGRAM,
  RAYDIUM_AMM_V4,
  RAYDIUM_CLMM,
  RAYDIUM_CPAMM,
  PUMP_FUN,
  ORCA_WHIRLPOOL,
  METEORA_DLMM,
]);

const DEX_NAMES: Record<string, string> = {
  [JUPITER_V6_PROGRAM]: 'Jupiter',
  [RAYDIUM_AMM_V4]: 'Raydium_V4',
  [RAYDIUM_CLMM]: 'Raydium_CLMM',
  [RAYDIUM_CPAMM]: 'Raydium_CPAMM',
  [PUMP_FUN]: 'PumpFun',
  [ORCA_WHIRLPOOL]: 'Orca',
  [METEORA_DLMM]: 'Meteora',
};

/** SPL Token program IDs */
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

const logger = new Logger('DexSwapParser');

/**
 * Parse a Yellowstone gRPC transaction update into zero or more DEX swaps.
 *
 * Strategy: We look at token balance changes (pre/post token balances)
 * to determine what tokens the trader swapped rather than decoding every
 * DEX instruction. This works universally across all DEXes since the net
 * balance change is the ground truth regardless of the instruction format.
 *
 * @param txUpdate - The `SubscribeUpdateTransaction` message from Yellowstone gRPC
 * @param monitorAddresses - Set of smart money addresses we are tracking
 */
export function parseTransaction(
  txUpdate: any,
  monitorAddresses: Set<string>,
  /** If true, parse swaps for ALL signers, not just monitored addresses */
  parseAllTraders = false,
): ParsedDexSwap[] {
  const results: ParsedDexSwap[] = [];

  try {
    const txn = txUpdate.transaction;
    if (!txn) return results;

    const meta = txn.meta;
    const message = txn.transaction?.message;
    if (!meta || !message) return results;

    // Skip failed transactions
    if (meta.err && Object.keys(meta.err).length > 0) return results;

    const signature = bs58.encode(txn.signature);
    const accountKeys = getAccountKeys(message, meta);

    // Check if any DEX program was involved
    const involvedDexes = findInvolvedDexes(accountKeys);
    if (involvedDexes.length === 0) return results;

    // Determine traders to parse
    let involvedTraders: string[];
    if (parseAllTraders) {
      // In burst-detection mode: treat the first account key (tx signer) as the trader
      involvedTraders = accountKeys.length > 0 ? [accountKeys[0]] : [];
    } else {
      involvedTraders = accountKeys.filter((addr) =>
        monitorAddresses.has(addr),
      );
    }
    if (involvedTraders.length === 0) return results;

    // Parse token balance changes from pre/post token balances
    const balanceChanges = computeTokenBalanceChanges(
      meta.preTokenBalances || [],
      meta.postTokenBalances || [],
    );

    // Also check native SOL balance changes
    const solChanges = computeSolBalanceChanges(
      meta.preBalances || [],
      meta.postBalances || [],
      accountKeys,
    );

    // For each monitored trader, determine what they swapped
    for (const trader of involvedTraders) {
      const traderTokenChanges = balanceChanges.get(trader);
      const traderSolChange = solChanges.get(trader) || 0n;

      // Combine SOL changes with token changes
      const allChanges = new Map<string, bigint>(traderTokenChanges || []);
      if (traderSolChange !== 0n) {
        const existing = allChanges.get(WSOL_MINT) || 0n;
        allChanges.set(WSOL_MINT, existing + traderSolChange);
      }

      // Find tokens that increased and decreased
      const increases: Array<{ mint: string; amount: bigint }> = [];
      const decreases: Array<{ mint: string; amount: bigint }> = [];

      for (const [mint, change] of allChanges) {
        if (change > 0n) {
          increases.push({ mint, amount: change });
        } else if (change < 0n) {
          decreases.push({ mint, amount: -change });
        }
      }

      if (increases.length === 0 || decreases.length === 0) continue;

      // Determine swap direction (buy or sell)
      // Buy = trader spent SOL/stablecoins, received a token
      // Sell = trader spent a token, received SOL/stablecoins
      for (const received of increases) {
        for (const spent of decreases) {
          const receivedIsQuote = isQuoteToken(received.mint);
          const spentIsQuote = isQuoteToken(spent.mint);

          let baseMint: string;
          let quoteMint: string;
          let baseAmount: bigint;
          let quoteAmount: bigint;
          let side: 'buy' | 'sell';

          if (spentIsQuote && !receivedIsQuote) {
            // Spent SOL/stable, received token → BUY
            baseMint = received.mint;
            quoteMint = spent.mint;
            baseAmount = received.amount;
            quoteAmount = spent.amount;
            side = 'buy';
          } else if (!spentIsQuote && receivedIsQuote) {
            // Spent token, received SOL/stable → SELL
            baseMint = spent.mint;
            quoteMint = received.mint;
            baseAmount = spent.amount;
            quoteAmount = received.amount;
            side = 'sell';
          } else {
            // Token-to-token swap: use the first involved DEX for naming
            baseMint = received.mint;
            quoteMint = spent.mint;
            baseAmount = received.amount;
            quoteAmount = spent.amount;
            side = 'buy';
          }

          // Prefer the real block time from Yellowstone (`createdAt` is a Timestamp
          // proto: {seconds, nanos}). Fall back to `blockTime` numeric field if present.
          // Only resort to `Date.now()` if neither is supplied (defensive — should never
          // happen for confirmed commitment updates).
          let blockTime = '0';
          const createdAt = txUpdate.createdAt;
          if (createdAt?.seconds !== undefined) {
            blockTime = String(createdAt.seconds);
          } else if (typeof txUpdate.blockTime === 'number') {
            blockTime = String(txUpdate.blockTime);
          } else if (txUpdate.slot) {
            // No explicit block time — fall back to current time with a safety cap.
            // Downstream `VALID_STRATEGY_DEX_TRADE_SECONDS` (120s) will reject stale data.
            blockTime = Math.floor(Date.now() / 1000).toString();
          }

          results.push({
            tx_id: signature,
            trader,
            base_mint: baseMint,
            quote_mint: quoteMint,
            block_time: blockTime,
            base_amount: baseAmount.toString(),
            quote_amount: quoteAmount.toString(),
            usd_value: '0', // Will be enriched later with price data
            side,
            dex: involvedDexes[0],
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Failed to parse transaction: ${(err as Error)}`);
  }

  return results;
}

// ── Helpers ────────────────────────────────────────────────────────────

function getAccountKeys(message: any, meta: any): string[] {
  const keys: string[] = [];

  // Static account keys from the message
  if (message.accountKeys) {
    for (const key of message.accountKeys) {
      if (typeof key === 'string') {
        keys.push(key);
      } else if (key instanceof Uint8Array || Buffer.isBuffer(key)) {
        keys.push(bs58.encode(key));
      }
    }
  }

  // Address table lookups (writable + readonly) from meta
  if (meta.loadedWritableAddresses) {
    for (const addr of meta.loadedWritableAddresses) {
      if (typeof addr === 'string') {
        keys.push(addr);
      } else if (addr instanceof Uint8Array || Buffer.isBuffer(addr)) {
        keys.push(bs58.encode(addr));
      }
    }
  }
  if (meta.loadedReadonlyAddresses) {
    for (const addr of meta.loadedReadonlyAddresses) {
      if (typeof addr === 'string') {
        keys.push(addr);
      } else if (addr instanceof Uint8Array || Buffer.isBuffer(addr)) {
        keys.push(bs58.encode(addr));
      }
    }
  }

  return keys;
}

function findInvolvedDexes(accountKeys: string[]): string[] {
  const result: string[] = [];
  for (const key of accountKeys) {
    if (DEX_PROGRAM_IDS.has(key)) {
      result.push(DEX_NAMES[key] || key);
    }
  }
  return result;
}

function computeTokenBalanceChanges(
  preBalances: any[],
  postBalances: any[],
): Map<string, Map<string, bigint>> {
  // Map<ownerAddress, Map<mint, changeAmount>>
  const changes = new Map<string, Map<string, bigint>>();

  // Only trust `bal.owner` — it is the wallet owner of the token account.
  // The previous fallback to `accountKeys[bal.accountIndex]` mapped balance changes
  // to the *token account address*, not the wallet owner, which attributed every swap
  // to the wrong "trader" and broke downstream monitoring.
  // Yellowstone always populates `owner` on TokenBalance messages (gRPC proto).
  const preMap = new Map<string, bigint>();
  for (const bal of preBalances) {
    const owner = bal.owner;
    const mint = bal.mint;
    if (!owner || !mint) continue;
    const key = `${owner}:${mint}`;
    const amount = BigInt(bal.uiTokenAmount?.amount || '0');
    preMap.set(key, (preMap.get(key) || 0n) + amount);
  }

  const postMap = new Map<string, bigint>();
  for (const bal of postBalances) {
    const owner = bal.owner;
    const mint = bal.mint;
    if (!owner || !mint) continue;
    const key = `${owner}:${mint}`;
    const amount = BigInt(bal.uiTokenAmount?.amount || '0');
    postMap.set(key, (postMap.get(key) || 0n) + amount);
  }

  // Compute deltas
  const allKeys = new Set([...preMap.keys(), ...postMap.keys()]);
  for (const key of allKeys) {
    const pre = preMap.get(key) || 0n;
    const post = postMap.get(key) || 0n;
    const delta = post - pre;
    if (delta === 0n) continue;

    const [owner, mint] = key.split(':');
    if (!changes.has(owner)) {
      changes.set(owner, new Map());
    }
    changes.get(owner)!.set(mint, delta);
  }

  return changes;
}

function computeSolBalanceChanges(
  preBalances: number[],
  postBalances: number[],
  accountKeys: string[],
): Map<string, bigint> {
  const changes = new Map<string, bigint>();
  const len = Math.min(preBalances.length, postBalances.length, accountKeys.length);
  for (let i = 0; i < len; i++) {
    const pre = BigInt(preBalances[i] || 0);
    const post = BigInt(postBalances[i] || 0);
    const delta = post - pre;
    if (delta !== 0n) {
      changes.set(accountKeys[i], delta);
    }
  }
  return changes;
}

function isQuoteToken(mint: string): boolean {
  return (
    mint === WSOL_MINT ||
    mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' || // USDC
    mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'    // USDT
  );
}
