#!/usr/bin/env node
/**
 * Data-center WebSocket bridge / mock.
 *
 * Stands in for the production `DATA_CENTER_WS` service that the closed-source
 * ELF used to provide. Two operating modes, switched via env:
 *
 *   1. **Bridge mode** (`TRADING_TRACKER_WS=ws://host:port` set)
 *      Connect to `trading-tracker-oss` via raw WebSocket, issue a
 *      jsonrpsee `trading_tracker_subscribe_token_price` subscription for
 *      every mint listed in `BRIDGE_MINTS` (comma-separated, base58), and
 *      re-emit each incoming `PoolPrice` as a `dexTradesNotify` event in
 *      the `TradeData` shape the strategy engine expects.
 *
 *   2. **Synthetic mock mode** (no `TRADING_TRACKER_WS`)
 *      Emit a random Raydium AMM v4 SOL/USDC trade every `TICK_MS` ms so
 *      the stream pipeline has something to consume even when the real
 *      tracker isn't available.
 *
 * Usage:
 *
 *     node dev-data-center.mjs                                 # mock mode
 *     TRADING_TRACKER_WS=ws://127.0.0.1:8080 \
 *         BRIDGE_MINTS=So11111111111111111111111111111111111111112,EPjFW… \
 *         node dev-data-center.mjs                             # bridge mode
 */

import { Server } from 'rpc-websockets';
import WebSocket from 'ws';

const PORT = Number(process.env.PORT || 18081);
const TICK_MS = Number(process.env.TICK_MS || 2000);
const TRADING_TRACKER_WS = process.env.TRADING_TRACKER_WS || '';
const BRIDGE_MINTS = (process.env.BRIDGE_MINTS || '').split(',').map(s => s.trim()).filter(Boolean);

// Production data-center exposed `ws://host:port/ws`. rpc-websockets derives
// the **namespace** from the URL pathname, so we must register every method
// and event in the `/ws` namespace — NOT the default `/`.
const NS = '/ws';
const server = new Server({ port: PORT, host: '0.0.0.0' });

// Register the `dexTradesNotify` event so clients can `.on('dexTradesNotify')`.
server.event('dexTradesNotify', NS);

let subId = 1;
const subs = new Set();

// `subscribeDexTrades(pools: string[])` — returns a subscription id string.
// Production behaviour: pools=[] means "all tracked pools".
server.register(
    'subscribeDexTrades',
    (params) => {
        const pools = Array.isArray(params?.[0]) ? params[0] : [];
        const id = `sub-${subId++}`;
        subs.add({ id, pools });
        console.log(`[mock-dc] subscribe id=${id} pools=${pools.length || 'all'}`);
        return id;
    },
    NS,
);

// Optional: `unsubscribeDexTrades(id)` for symmetry.
server.register(
    'unsubscribeDexTrades',
    (params) => {
        const id = params?.[0];
        for (const s of subs) if (s.id === id) subs.delete(s);
        return true;
    },
    NS,
);

// -----------------------------------------------------------
// Synthetic trade generator
// -----------------------------------------------------------

// Stable test pool: SOL / USDC (Raydium AMM v4 on mainnet).
const POOL = {
  pool_address: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
  base_mint: 'So11111111111111111111111111111111111111112',   // SOL
  quote_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
};

function randomTrade() {
  const priceUsd = 180 + (Math.random() - 0.5) * 8; // ~176–184
  const baseAmount = (Math.random() * 2 + 0.1).toFixed(6);
  const quoteAmount = (Number(baseAmount) * priceUsd).toFixed(6);
  const usdValue = quoteAmount; // USDC ≈ USD for this pool
  return {
    ...POOL,
    base_amount: baseAmount,
    quote_amount: quoteAmount,
    usd_value: usdValue,
    base_vault_balance: (100000 + Math.random() * 1000).toFixed(6),
    quote_vault_balance: (18000000 + Math.random() * 200000).toFixed(6),
    block_time: Math.floor(Date.now() / 1000),
    signer: 'DEVMOCKsignerAddress11111111111111111111111',
    tx_id: `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function scheduleTick() {
  setInterval(() => {
    if (subs.size === 0) return;
    const trades = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, randomTrade);
    // `emit(name, params, ns)` fan-outs to subscribers in that namespace.
    server.emit('dexTradesNotify', { result: trades }, NS);
    process.stdout.write(`[mock-dc] tick ${trades.length} trades → ${subs.size} subs\n`);
  }, TICK_MS);
}

// -----------------------------------------------------------
// Bridge mode: subscribe to trading-tracker-oss (jsonrpsee) and
// translate PoolPrice messages into the TradeData shape.
// -----------------------------------------------------------

/**
 * Translate a tracker `PoolPrice` into a data-center `TradeData`.
 *
 * Schema gaps (PoolPrice doesn't carry these; we inject dev-safe defaults):
 *   - `base_vault_balance` / `quote_vault_balance` — not tracked; strategy
 *     engine uses these for pool-depth sanity checks. We send large numbers
 *     so simple liquidity thresholds don't fire a false "illiquid" signal.
 *     Production fix: extend `PoolPrice` with vault balances, OR query them
 *     separately (e.g. via a Solana RPC getBalance call keyed off pool).
 *   - `signer` / `tx_id` — PoolPrice is aggregated per-block, not per-tx.
 *     We emit a placeholder derived from (slot, pool) so downstream
 *     dedup/cache keys stay unique but no smart-wallet tracking fires.
 */
function translatePoolPriceToTradeData(pp) {
  const price = Number(pp.price);
  const baseAmount = Number(pp.base_volume ?? '0');
  const quoteAmount = baseAmount * price;
  const devMarker = `bridge-${pp.slot}-${String(pp.pool).slice(0, 6)}`;
  return {
    pool_address: String(pp.pool),
    base_mint: String(pp.base_mint),
    quote_mint: String(pp.quote_mint),
    base_amount: baseAmount.toString(),
    quote_amount: quoteAmount.toString(),
    usd_value: quoteAmount.toString(), // approximation: assume quote ≈ USD
    base_vault_balance: '1000000000', // dev placeholder, see comment above
    quote_vault_balance: '100000000000',
    block_time: pp.timestamp,
    signer: devMarker,
    tx_id: devMarker,
  };
}

function runBridge() {
  if (!BRIDGE_MINTS.length) {
    console.error('[bridge] TRADING_TRACKER_WS is set but BRIDGE_MINTS is empty — nothing to subscribe to');
    console.error('[bridge] set BRIDGE_MINTS=mint1,mint2,...');
    process.exit(1);
  }
  console.log(`[bridge] connecting to trading-tracker-oss at ${TRADING_TRACKER_WS}`);
  console.log(`[bridge] subscribing to ${BRIDGE_MINTS.length} mint(s): ${BRIDGE_MINTS.join(', ')}`);

  let ws;
  let reqId = 1;
  // `requestId -> mint` so we can correlate subscription-id replies with the
  // mint we subscribed for (also useful for diagnostics).
  const pendingSubs = new Map();
  // `subscriptionId -> mint` for inbound notifications.
  const subIdToMint = new Map();
  let reconnectAttempt = 0;

  const connect = () => {
    ws = new WebSocket(TRADING_TRACKER_WS);

    ws.on('open', () => {
      reconnectAttempt = 0;
      console.log('[bridge] connection opened, sending subscriptions');
      for (const mint of BRIDGE_MINTS) {
        const id = reqId++;
        pendingSubs.set(id, mint);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'trading_tracker_subscribe_token_price',
          params: [mint],
        }));
      }
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        console.warn('[bridge] unparsable frame, dropping');
        return;
      }
      // Reply to a subscription request — { id, result: <sub_id> }
      if (msg.id !== undefined && pendingSubs.has(msg.id)) {
        const mint = pendingSubs.get(msg.id);
        pendingSubs.delete(msg.id);
        if (msg.error) {
          console.error(`[bridge] subscribe failed for ${mint}:`, msg.error);
          return;
        }
        const subId = msg.result;
        subIdToMint.set(String(subId), mint);
        console.log(`[bridge] subscribed to ${mint} → sub_id=${subId}`);
        return;
      }
      // Notification — { method: 'trading_tracker_token_price',
      //                  params: { subscription: <sub_id>, result: <PoolPrice> } }
      if (msg.method && msg.params && msg.params.subscription !== undefined) {
        const poolPrice = msg.params.result;
        if (!poolPrice) return;
        const tradeData = translatePoolPriceToTradeData(poolPrice);
        server.emit('dexTradesNotify', { result: [tradeData] }, NS);
        process.stdout.write(`[bridge] ${poolPrice.kind}@${tradeData.pool_address.slice(0, 6)}… price=${poolPrice.price} slot=${poolPrice.slot} → ${subs.size} subs\n`);
      }
    });

    ws.on('close', (code, reason) => {
      reconnectAttempt++;
      const backoff = Math.min(30_000, 500 * 2 ** Math.min(reconnectAttempt, 6));
      console.warn(`[bridge] connection closed (code=${code} reason=${reason}), reconnecting in ${backoff}ms`);
      setTimeout(connect, backoff);
    });

    ws.on('error', (err) => {
      console.error('[bridge] ws error:', err.message);
      // `close` will fire after error; reconnect is handled there
    });
  };

  connect();
}

// -----------------------------------------------------------
// Bootstrap (mode selector)
// -----------------------------------------------------------

if (TRADING_TRACKER_WS) {
  runBridge();
  console.log(`[bridge] listening on ws://0.0.0.0:${PORT}${NS} (ready to serve dexauto-server)`);
} else {
  scheduleTick();
  console.log(`[mock-dc] listening on ws://0.0.0.0:${PORT}${NS} (tick=${TICK_MS}ms)`);
  console.log(`[mock-dc] synthetic mode — set TRADING_TRACKER_WS+BRIDGE_MINTS to bridge real tracker data`);
}

process.on('SIGINT', () => { console.log('\n[dc] shutting down'); process.exit(0); });
