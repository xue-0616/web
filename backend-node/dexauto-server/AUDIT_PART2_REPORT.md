# Security & Logic Audit Report — dexauto-server Part 2

**Date:** 2026-04-15  
**Scope:** token, favorite, message-notifier, transfer-subscriber, transfer-syncer, stream, automatic-strategy (original), config, common, main.ts/app.controller.ts

---

## 1. Token Module (`src/modules/token/`)

### 1.1 token.controller.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| T-1 | **No input validation on mint addresses** | MEDIUM | `mintAddress` path/query params are passed directly without base58 validation. Malformed strings could cause unhandled exceptions in downstream Solana SDK calls (`new web3.PublicKey(...)`) rather than clean 400 errors. |
| T-2 | **Unbounded `limit` parameter** | MEDIUM | `getTokenBySymbol`, `getTokenByAddress`, `getTokenTopHolders`, `getTokenTrades` accept user-supplied `limit` with no upper bound. A user can pass `limit=999999` to cause expensive ClickHouse/DB queries. Default limits (20, 100) only apply when omitted. |
| T-3 | **No rate limiting on search endpoints** | LOW | `/search`, `/searchByAddress`, `/trending` are unauthenticated and have no rate limiting. Could be abused for scraping or DoS. |
| T-4 | **No authentication on any endpoint** | LOW | All token endpoints are public (no `@UseGuards(AuthGuard)`). This is likely intentional for a public API, but combined with T-2 and T-3, it creates abuse potential. |
| T-5 | **`getTokenPrice` — `interval` passed as table name selector** | OK | The `interval` parameter goes through `getPriceHistoryQueryTable()` switch statement which maps to hardcoded table names. No injection risk. `{table:Identifier}` in ClickHouse parameterized query is safe. |

### 1.2 token.service.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| T-6 | **SSRF via `fetchTokenMetadata`** | MEDIUM | `tokenInfo.metaDataUri` is fetched with `fetch()` without URL validation. A malicious token's metadata URI could point to internal services (e.g., `http://169.254.169.254/...` for cloud metadata). Should validate URL scheme and block private IPs. |
| T-7 | **Symbol search SQL — safe (parameterized)** | OK | `getTokensInfoBySymbol` uses TypeORM `.where('LOWER(token.symbol) LIKE LOWER(:symbol)', { symbol: ... })` — properly parameterized, no SQL injection. |
| T-8 | **ClickHouse queries use parameterized placeholders** | OK | All queries use `{param:Type}` syntax — ClickHouse parameterized queries. No SQL injection risk. |
| T-9 | **`findByMintAddress` strips null bytes** | OK | `mintAddress.replace(/\0/g, '')` — good defensive practice. |
| T-10 | **External API call to GoPlus without timeout** | LOW | `fetchTokenAudit` calls `https://api.gopluslabs.io/...` with `fetch()` — no timeout set. Could hang indefinitely if the API is slow. |

### 1.3 clickhouse-query.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| T-11 | **BANNED_TOKENS hardcoded inline in SQL template** | LOW | `BANNED_TOKENS` are string-interpolated into the SQL template via `${exports.BANNED_TOKENS.map(token => \`'\${token}'\`).join(',')}`. Since these are hardcoded constants (not user input), this is safe, but the pattern is fragile — any future dynamic input would be injectable. |

---

## 2. Favorite Module (`src/modules/favorite/`)

### 2.1 favorite.controller.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| F-1 | **All endpoints use AuthGuard** | OK | Properly authenticated. |
| F-2 | **Ownership scoped by userId from JWT** | OK | All operations filter by `req.userId` — cannot access other users' favorites. |

### 2.2 favorite.service.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| F-3 | **No limit on favorites per user** | LOW | Users can add unlimited favorites. Should consider a max limit (e.g., 500) to prevent DB bloat. |
| F-4 | **Duplicate handling is correct** | OK | Checks for existing favorite before insert; handles soft-deleted records with `restore()`. |
| F-5 | **No validation on `chain` field in DTO** | LOW | `FavoriteDto.chain` is just a `number` without enum validation. Invalid chain values would silently work. |
| F-6 | **`getFavoriteList` — chain passed as raw number** | OK | TypeORM parameterizes the value in `where: { userId, chain }`. |

---

## 3. Message-Notifier Module (`src/modules/message-notifier/`)

### 3.1 message-notifier.controller.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| N-1 | **All endpoints use AuthGuard** | OK | Properly authenticated. |

### 3.2 message-notifier.service.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| N-2 | **No validation on Firebase token** | MEDIUM | `addFirebaseToken(userId, token)` accepts any string as a Firebase registration token. There's no format validation. While Firebase will reject invalid tokens on send, storing arbitrary strings wastes Redis memory. An attacker could flood Redis with garbage tokens. |
| N-3 | **No limit on tokens per user** | MEDIUM | `addFirebaseToken` uses `ZADD` without checking cardinality. A user could register thousands of tokens, which: (1) bloats Redis, (2) causes `sendEachForMulticast` to send to many tokens (Firebase caps at 500 per call — will error). |
| N-4 | **Token registered only for authenticated user** | OK | `userId` comes from JWT `req.userId` — cannot register tokens for other users. |
| N-5 | **EXPIRE_TIME miscalculated** | LOW | `EXPIRE_TIME = 1000 * 60 * 60 * 24 * 60` = 5,184,000,000 ms but `redisClient.expire(cacheKey, EXPIRE_TIME)` expects **seconds**. This sets TTL to ~164 years instead of 60 days. The tokens never expire in practice. The `zremrangebyscore` cleanup also uses this same wrong value. |
| N-6 | **Notification content not sanitized** | LOW | Notification titles/bodies are constructed from internal data (order amounts, token symbols). Since these go to Firebase (not rendered as HTML), XSS is not a concern. However, malicious token symbols could contain misleading content (social engineering). |
| N-7 | **`getNotifies` — startId and limit not validated** | LOW | `limit` has no upper bound check. `startId` is used in `MoreThan()` — safe from injection via TypeORM. |
| N-8 | **Firebase credentials in constructor** | OK | Loaded from ConfigService (secret file). Not hardcoded. |

### 3.3 DTOs

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| N-9 | **`NotifierRegisterDto` has no decorators** | MEDIUM | `token: string` has no `@IsString()` or `@IsNotEmpty()` validation decorator. With `ValidationPipe` globally enabled, this means **any** value (including objects, arrays) will pass through. Should add class-validator decorators. |
| N-10 | **`NotifiesQueryDto` has no decorators** | LOW | Same issue — no validation decorators on `startId` and `limit`. |

---

## 4. Transfer-Subscriber Module (`src/modules/transfer-subscriber/`)

### 4.1 transfer-subscriber.service.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| TS-1 | **WebSocket connection to data center** | OK | Uses `configService.getOrThrow('dataCenterWs')` — from config. Reconnect enabled with `max_reconnects: 0` (unlimited). |
| TS-2 | **Distributed lock with Redlock** | OK | Uses Redlock for leader election. Lock duration 300s with extension every 240s. Good pattern. |
| TS-3 | **`trySyncAccountDexTrades` strips null bytes** | OK | Properly cleans `\x00` from `base_mint`, `quote_mint`, `trader`. |
| TS-4 | **No validation on WebSocket incoming data** | MEDIUM | Data received from WebSocket (`nativeTransfersNotify`, `tokenTransfersNotify`, `accountDexTradesNotify`) is used directly without schema validation. If the data center is compromised or sends malformed data, it could cause crashes or incorrect state. |
| TS-5 | **Lock extension error handling** | LOW | `extendLock` catches errors but only logs and waits 300s. If lock is lost, another instance could take over, but this instance doesn't stop processing — could cause double-processing. |

---

## 5. Transfer-Syncer Module (`src/modules/transfer-syncer/`)

### 5.1 transfer-syncer.service.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| SY-1 | **Transaction deduplication** | OK | Checks `tradingOrderRepository.findOne({ where: { txId: ... } })` before processing. Prevents duplicate processing. |
| SY-2 | **Database transaction with pessimistic locking** | OK | Uses `queryRunner` with `pessimistic_write` lock on wallet — prevents race conditions on balance updates. |
| SY-3 | **Missing `await` on `notifyTokenWithdraw`** | LOW | Line: `this.messageNotifyService.notifyTokenWithdraw(...)` (withdraw path for token transfers) is called without `await`. The notification is fire-and-forget. If it fails, no error is logged. Same for `notifyTokenDeposit`. Contrast with native transfers which also lack await but are at least consistent. |
| SY-4 | **Error in one transfer doesn't affect others** | OK | Each transfer is processed in try/catch within the for loop — good isolation. |
| SY-5 | **`initWallets` infinite retry loop** | LOW | Retries every 30s indefinitely. Could keep the module in an init state forever if DB is permanently unreachable. Should have a max retry count or circuit breaker. |
| SY-6 | **No validation on incoming transfer data types** | MEDIUM | `transfer.amount`, `transfer.raw_amount`, etc. are used directly in Decimal arithmetic and BigInt casts. If they're not valid numbers (e.g., undefined or NaN), this would cause unhandled errors. |

---

## 6. Stream Module (`src/modules/stream/`)

### 6.1 stream.gateway.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| ST-1 | **No WebSocket authentication** | HIGH | The WebSocket gateway has `cors: true` and **no authentication**. Any client can connect and subscribe to any pool's trade data. While the data may be intended as public, this allows: (1) Unlimited connections consuming server resources, (2) Monitoring of all pool activity without restriction. |
| ST-2 | **No message schema validation** | MEDIUM | `JSON.parse(rawData.toString())` — if message is valid JSON but has missing/wrong-typed fields (e.g., `message.method` undefined, `message.params` not array), it could cause runtime errors. |
| ST-3 | **No connection limit per IP** | MEDIUM | No limit on concurrent WebSocket connections. Could be used for resource exhaustion. |
| ST-4 | **No subscription limit per client** | MEDIUM | A single client can subscribe to unlimited pools, causing the upstream data center to track many pools. |
| ST-5 | **Pool address not validated** | LOW | `poolAddress` from `message.params` is passed directly to upstream without validation. |

### 6.2 stream.service.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| ST-6 | **Memory leak risk — subscriptions never cleaned if upstream fails** | LOW | If `unsubscribeFromPool` fails (e.g., socket disconnected), the subscription remains in the `subscriptions` Map. On reconnect, `resubscribeToPools` re-subscribes all pools, which is good. |
| ST-7 | **No pool address format validation before upstream call** | LOW | Arbitrary strings are passed as pool addresses to the upstream data center. |

---

## 7. Automatic-Strategy Module (`src/modules/automatic-strategy/`)

### 7.1 automatic-strategy.controller.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| AS-1 | **All endpoints except `chainCM/channel` use AuthGuard** | HIGH | `chainFMChannelInfo` endpoint is **unauthenticated**. It calls an external API (`chain.fm`) with a user-supplied URL. This is an **SSRF vector** — an attacker can use it to probe internal services by supplying URLs like `http://127.0.0.1:3000/...`. |
| AS-2 | **Verbose logging of strategy objects** | MEDIUM | `this.logger.info(JSON.stringify(automaticStrategy))` logs entire strategy objects including wallet IDs, monitor addresses, and configuration. In production, this could leak sensitive info to log aggregation systems. |

### 7.2 automatic-strategy.service.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| AS-3 | **Max strategies per user enforced** | OK | `MAX_AUTOMATIC_STRATEGIES = 10` — properly checked before creation. |
| AS-4 | **Max limits enforced for sub-items** | OK | `MAX_MONITOR_ADDRESSES = 300`, `MAX_ADDRESS_SUBS = 10`, `MAX_TRIGGERS = 5`, `MAX_AUTO_TRADES = 1`, `MAX_TRIGGER_ITEMS = 3` — all checked. |
| AS-5 | **Strategy ownership validated** | OK | All queries filter by `userId` — cannot access or modify other users' strategies. |
| AS-6 | **Update authorization correct** | OK | `updateAutomaticStrategy` finds strategy by `id + userId` — ownership enforced. |
| AS-7 | **Wallet ownership validated on auto-trade** | OK | Wallets are fetched with `userId` + `isActive` filter before linking to strategies. |
| AS-8 | **`getChainFMChannelInfo` — URL parsing** | MEDIUM | `getChainFMChannelId(url)` extracts channel ID, then `chainFMClient.getChannelInfo(channelId)` calls external API. The `url` parameter is user-supplied and unauthenticated (AS-1). Even if channel ID extraction limits the attack surface, the URL parsing itself could be exploited. |
| AS-9 | **Delete is soft-delete (status change)** | OK | `AutomaticStrategyStatus.Deleted` — strategies are soft-deleted, syncer is notified. |
| AS-10 | **Default strategies hardcoded with ChainFM URLs** | LOW | Default strategies reference external ChainFM channel URLs. If these channels are removed/modified, new user onboarding would fail silently. |
| AS-11 | **`unsoldEvents` query uses `autoTradeStatus: 'pending' as any`** | LOW | Type cast `as any` bypasses type checking. If the enum value changes, this would silently break. |

---

## 8. Config (`src/config/`)

### 8.1 configuration.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| C-1 | **Secrets loaded from file, not env vars** | OK | Secrets are loaded from `SECRET_PATH` file — good practice. Environment-specific secrets are separated. |
| C-2 | **Missing secrets throw at startup** | OK | Uses `??` with throw-IIFE pattern — app won't start with missing secrets. |
| C-3 | **PORT defaults to 3000** | OK | Sensible default. |
| C-4 | **Geyser token is optional, defaults to empty string** | OK | Appropriate for optional feature. |

### 8.2 database.config.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| C-5 | **`ssl.rejectUnauthorized: false`** | MEDIUM | Disables SSL certificate validation for PostgreSQL. This allows MITM attacks on the DB connection. In production, should use proper CA certificates. |
| C-6 | **`synchronize: false`** | OK | Good — auto-sync is disabled. Migrations are used. |

### 8.3 redis.config.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| C-7 | **`tls.rejectUnauthorized: false`** | MEDIUM | Same as C-5 — disables TLS cert validation for Redis. MITM risk. |
| C-8 | **Redis DB defaults to 0** | OK | Sensible default with fallback. |

### 8.4 clickhouse.config.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| C-9 | **ClickHouse config from secrets file** | OK | Properly loaded from secrets. |
| C-10 | **No TLS configuration for ClickHouse** | LOW | No SSL/TLS settings visible. Depending on deployment, ClickHouse might be accessed over plaintext. |

---

## 9. Common Utilities (`src/common/`)

### 9.1 tradingClient.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| U-1 | **HTTP client uses axios with baseURL only** | OK | No auth tokens or API keys in the client — requests go to internal trading server. |
| U-2 | **No request timeout configured** | MEDIUM | `axios.create({ baseURL: url })` — no timeout set. Requests to the trading server could hang indefinitely. Should set a reasonable timeout (e.g., 30s). |
| U-3 | **Fee rate hardcoded to 1%** | OK | `feeRate: new Decimal(0.01)` — intentional business logic. |
| U-4 | **Error handling distinguishes BadRequest vs Unknown** | OK | Good pattern — BadRequestException for code 2, UnknownError for others. |

### 9.2 pendingOrder.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| U-5 | **Infinite retry loop on swap** | MEDIUM | The `wait()` method retries indefinitely. For `BadRequestException`, it retries with increasing delays (1s → 300s after 3 failures), but for other errors, it retries every 20s forever. A permanently failing order will consume resources indefinitely. |
| U-6 | **Transaction integrity with pessimistic locking** | OK | Wallet balance updates use `queryRunner` + `pessimistic_write` lock — safe against race conditions. |
| U-7 | **Position tracking error doesn't fail the order** | OK | `trackPosition` is in try/catch — monitoring failure doesn't affect the trade. |

### 9.3 genericAddress.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| U-8 | **Address validation delegates to SDK** | OK | `new web3.PublicKey(address)` / `ethers.getAddress(...)` — proper validation. Invalid addresses will throw. |
| U-9 | **Signature verification correct** | OK | Uses `sign_detached_verify` from tweetnacl for Solana, `ethers.verifyMessage` for EVM. |

### 9.4 utils.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| U-10 | **`assertNever` as exhaustiveness check** | OK | Good TypeScript pattern. |

### 9.5 genericContractAddress.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| U-11 | **Trading account PDA differs by env** | OK | `getTradingAccount()` uses env-based switch. |
| U-12 | **Hardcoded public keys for trading accounts** | OK | These are program-derived addresses (PDAs) — public by nature. |

---

## 10. main.ts and app.controller.ts

### 10.1 main.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| M-1 | **CORS configured as `origin: '*'` with `credentials: true`** | HIGH | This is a **dangerous combination**. While most browsers block `origin: *` with credentials, the intent to allow all origins with credentials suggests a misunderstanding. If CORS is relaxed further (e.g., reflecting the Origin header), this becomes exploitable. **`origin: '*'`** should be replaced with specific allowed origins, especially since the app handles financial transactions. |
| M-2 | **`allowedHeaders: '*'` and `exposedHeaders: '*'`** | MEDIUM | Overly permissive. Should whitelist specific headers (Authorization, Content-Type, etc.). |
| M-3 | **Swagger docs exposed** | LOW | `SwaggerModule.setup('api-docs', ...)` — API documentation is publicly accessible. Should be disabled or auth-protected in production. |
| M-4 | **`ValidationPipe` is global** | OK | Good — enables class-validator for all endpoints. However, many DTOs lack validation decorators (see N-9, N-10), rendering this ineffective for those endpoints. |
| M-5 | **WebSocket adapter configured** | OK | Uses `WsAdapter` from `@nestjs/platform-ws`. |
| M-6 | **Shutdown hooks enabled** | OK | `app.enableShutdownHooks()` — proper cleanup on termination. |

### 10.2 app.controller.ts

| # | Finding | Severity | Details |
|---|---------|----------|---------|
| M-7 | **Health check endpoint** | OK | Simple `GET /` returning a string — no security concerns. |

---

## Summary of Critical/High Findings

| ID | Module | Severity | Issue |
|----|--------|----------|-------|
| **ST-1** | stream | **HIGH** | WebSocket gateway has no authentication — anyone can connect and subscribe to all pool data, unlimited connections |
| **AS-1** | automatic-strategy | **HIGH** | `chainCM/channel` endpoint is unauthenticated and performs external HTTP requests with user-supplied URL — **SSRF** |
| **M-1** | main.ts | **HIGH** | `CORS origin: '*'` with `credentials: true` — dangerous CORS misconfiguration for a financial application |

## Summary of Medium Findings

| ID | Module | Issue |
|----|--------|-------|
| T-1 | token | No input validation on mint addresses |
| T-2 | token | Unbounded `limit` parameters on queries |
| T-6 | token | SSRF via `fetchTokenMetadata` (internal URL fetching) |
| N-2 | message-notifier | No validation on Firebase token format |
| N-3 | message-notifier | No limit on Firebase tokens per user |
| N-9 | message-notifier | DTOs lack validation decorators |
| TS-4 | transfer-subscriber | No schema validation on WebSocket data |
| SY-6 | transfer-syncer | No validation on incoming transfer data types |
| ST-2, ST-3, ST-4 | stream | Missing message validation, connection limits, subscription limits |
| AS-2 | automatic-strategy | Verbose logging of sensitive strategy data |
| AS-8 | automatic-strategy | URL parsing risk in ChainFM channel info |
| C-5, C-7 | config | `rejectUnauthorized: false` for DB and Redis TLS |
| U-2 | tradingClient | No request timeout on axios HTTP client |
| U-5 | pendingOrder | Infinite retry loop on permanently failing swaps |
| M-2 | main.ts | Overly permissive CORS headers |

---

## Recommended Priority Actions

1. **Add WebSocket authentication** to StreamGateway (ST-1)
2. **Add AuthGuard to `chainCM/channel` endpoint** or validate/restrict URLs (AS-1)
3. **Fix CORS** — replace `origin: '*'` with specific allowed origins (M-1)
4. **Add input validation** (max limits, base58 format checks) on token endpoints (T-1, T-2)
5. **Add class-validator decorators** to all DTOs (N-9, N-10 and others)
6. **Fix EXPIRE_TIME units** in message-notifier (N-5 — currently ~164 years instead of 60 days)
7. **Enable TLS certificate validation** for DB and Redis in production (C-5, C-7)
8. **Add request timeouts** to all external HTTP calls (U-2, T-10)
9. **Add SSRF protection** for metadata URL fetching (T-6)
10. **Limit Firebase tokens per user** to prevent Redis bloat (N-3)
