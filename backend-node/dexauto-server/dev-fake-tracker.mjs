#!/usr/bin/env node
/**
 * Dev-only fake of `trading-tracker-oss`'s jsonrpsee WebSocket RPC server.
 *
 * Emulates just enough of the `trading_tracker_subscribe_token_price`
 * subscription so the bridge inside `dev-data-center.mjs` can be exercised
 * end-to-end without a real Substreams endpoint + .spkg deployment.
 *
 * Wire protocol (must match what `backend-rust/trading-tracker-oss/src/rpc.rs`
 * produces):
 *
 *   subscribe request:
 *     {"jsonrpc":"2.0","id":1,"method":"trading_tracker_subscribe_token_price",
 *      "params":["<base58-mint>"]}
 *
 *   subscribe response:
 *     {"jsonrpc":"2.0","id":1,"result":"<sub_id>"}
 *
 *   notification (server-pushed):
 *     {"jsonrpc":"2.0","method":"trading_tracker_token_price",
 *      "params":{"subscription":"<sub_id>","result":<PoolPrice>}}
 *
 * `PoolPrice` JSON shape (from `src/dex_pool/mod.rs` with serde):
 *   {
 *     "kind":       "raydium_amm" | "raydium_clmm" | "raydium_cpmm" | "pump",
 *     "pool":       "<base58>",
 *     "base_mint":  "<base58>",
 *     "quote_mint": "<base58>",
 *     "price":      "180.25",      // Decimal serialised as string
 *     "base_volume":"1.5",
 *     "slot":       12345,
 *     "timestamp":  1700000000
 *   }
 *
 * Usage:
 *   node dev-fake-tracker.mjs                    # :8080, 1 Hz tick
 *   PORT=8080 TICK_MS=500 node dev-fake-tracker.mjs
 */

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8080);
const TICK_MS = Number(process.env.TICK_MS || 1000);

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

// Map `sub_id -> { ws, mint }`. We fan-out a synthetic PoolPrice to every
// subscription whose (base_mint | quote_mint) matches the tick's mint pair.
const subs = new Map();
let nextSubId = 1;

// A stable dev pool — SOL / USDC on Raydium AMM v4.
const POOL = {
  kind: 'raydium_amm',
  pool: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
  base_mint: 'So11111111111111111111111111111111111111112',   // SOL
  quote_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
};

function genPoolPrice() {
  const price = 180 + (Math.random() - 0.5) * 8; // 176 – 184
  const baseVolume = (Math.random() * 2 + 0.1).toFixed(6);
  return {
    ...POOL,
    price: price.toFixed(6),
    base_volume: baseVolume,
    slot: Date.now() & 0xFFFFFFFF, // bogus but monotonic-ish
    timestamp: Math.floor(Date.now() / 1000),
  };
}

wss.on('connection', (ws) => {
  console.log('[fake-tracker] client connected');

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.method === 'trading_tracker_subscribe_token_price') {
      const mint = msg.params?.[0];
      if (typeof mint !== 'string') {
        ws.send(JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          error: { code: -32602, message: 'missing mint param' },
        }));
        return;
      }
      const subId = String(nextSubId++);
      subs.set(subId, { ws, mint });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: subId }));
      console.log(`[fake-tracker] sub ${subId} → ${mint}`);
    } else if (msg.method === 'trading_tracker_add_pool') {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null }));
    } else {
      ws.send(JSON.stringify({
        jsonrpc: '2.0', id: msg.id ?? null,
        error: { code: -32601, message: 'Method not found' },
      }));
    }
  });

  ws.on('close', () => {
    for (const [subId, s] of subs) if (s.ws === ws) subs.delete(subId);
    console.log('[fake-tracker] client disconnected');
  });
});

setInterval(() => {
  if (subs.size === 0) return;
  const pp = genPoolPrice();
  let fanout = 0;
  for (const [subId, s] of subs) {
    if (pp.base_mint !== s.mint && pp.quote_mint !== s.mint) continue;
    if (s.ws.readyState !== 1) continue; // not OPEN
    s.ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'trading_tracker_token_price',
      params: { subscription: subId, result: pp },
    }));
    fanout++;
  }
  if (fanout) process.stdout.write(`[fake-tracker] tick price=${pp.price} → ${fanout} subs\n`);
}, TICK_MS);

console.log(`[fake-tracker] listening on ws://0.0.0.0:${PORT} (tick=${TICK_MS}ms)`);
process.on('SIGINT', () => { console.log('\n[fake-tracker] shutdown'); process.exit(0); });
