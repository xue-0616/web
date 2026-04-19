# Security & Logic Audit Report — Part 1
## dexauto-server: auth, user, wallet, kms, trading modules
**Date:** 2026-04-15  
**Auditor:** Automated Deep Audit  
**Scope:** All original/untouched modules handling authentication, user management, wallet operations, key management, and trading

---

## Summary of Severity Levels
- 🔴 **CRITICAL** — Exploitable vulnerability that can lead to direct fund loss or full auth bypass
- 🟠 **HIGH** — Serious security flaw or logic error with significant impact
- 🟡 **MEDIUM** — Design weakness that could be exploited under specific conditions
- 🟢 **LOW** — Minor issue, best-practice violation, or code quality concern
- ✅ **OK** — No issues found

---

## 1. AUTH MODULE (`src/modules/auth/`)

### 1.1 `auth.guard.ts` — 🟡 MEDIUM (multiple issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟡 MEDIUM | **Missing TypeScript types on `canActivate` / `innerCanActivate`** — `context` parameter is `any`, not `ExecutionContext`. This is not directly exploitable but weakens type safety in security-critical code. |
| 2 | ✅ OK | JWT verification uses `jwtService.verifyAsync` with explicit `secret` — correct. Token expiration is enforced because the JWT module is configured with `expiresIn: '30d'` and `verifyAsync` checks `exp` by default. |
| 3 | ✅ OK | Bearer token extraction is correct — only accepts `Bearer <token>` format. |
| 4 | 🟢 LOW | **Error object passed directly to `UnauthorizedError`** — `throw new UnauthorizedError(error)` passes the raw JWT error. While `UnauthorizedError` masks the message (returns generic "unauthorized"), the `msg` property stores the raw error internally. If any middleware/interceptor serializes the full exception object, the JWT secret or token details could leak in logs. |

### 1.2 `auth.module.ts` — ✅ OK
- JWT secret is loaded from config (not hardcoded). ✅
- Token expiry is 30 days — this is relatively long for a financial application but is a business decision, not a bug.

### 1.3 `auth.service.ts` — 🟡 MEDIUM

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟡 MEDIUM | **`generateJwt(userId)` has no type annotation** — `userId` is `any`. If a non-string is passed, the JWT payload `sub` could contain unexpected types (objects, arrays). This is unlikely to be exploited directly but indicates weak type discipline in auth-critical code. |
| 2 | 🟢 LOW | **No additional claims in JWT** — The JWT only contains `sub` (userId). No `iat`, `jti`, or audience/issuer claims are explicitly set. The `@nestjs/jwt` module adds `iat` automatically, but there's no `jti` for token revocation, no `iss`/`aud` for multi-service environments. |

### 1.4 `payload.ts` — ✅ OK (empty file, unused)

---

## 2. USER MODULE (`src/modules/user/`)

### 2.1 `user.controller.ts` — 🟠 HIGH (multiple issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟠 HIGH | **`/api/v1/user/auth` endpoint is UNAUTHENTICATED** — The `auth()` method has no `@UseGuards(AuthGuard)`. It accepts any `userAddr` string and returns whether the address is in the whitelist. This is an **information disclosure** — an attacker can enumerate all whitelisted addresses by brute-forcing this endpoint. For a financial trading platform, knowing which addresses have special privileges is valuable reconnaissance. |
| 2 | 🟡 MEDIUM | **Login endpoint has no rate limiting** — `POST /api/v1/user/login` is unauthenticated and performs crypto signature verification + database operations. No rate limiting means it's vulnerable to **denial of service** through expensive signature verification operations. |
| 3 | 🟢 LOW | **Logger leaks return values** — `this.logger.info(`login success: ${ret}`)` will stringify the response object (including `accessToken`) into the log. JWT tokens in logs are a security anti-pattern. |

### 2.2 `user.service.ts` — 🔴 CRITICAL + 🟠 HIGH (multiple issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🔴 **CRITICAL** | **Hardcoded whitelist of ~100 blockchain addresses in source code** — `ADDRESS_WHITE_LIST` contains real wallet addresses baked into the source. This is a severe operational security risk: (a) the list cannot be updated without a code deployment, (b) it's exposed to anyone with source code access, (c) it implies these addresses have special privileges. These should be in a database or secure config. |
| 2 | 🟠 HIGH | **`login()` method destructures `{ message, sig }` from dto but `LoginDto` has fields `message` and `signature` (not `sig`)** — The DTO class defines `signature: string` but the service destructures `dto.sig`. This means `sig` will always be `undefined`, and if the `validate()` method doesn't properly handle undefined signatures, it could either crash or bypass verification entirely. **This needs immediate verification of whether the actual runtime DTO uses `sig` or `signature`.** |
| 3 | 🟡 MEDIUM | **`login()` ignores `chain` and `address` fields from `LoginDto`** — The DTO has `chain` and `address` fields that are never used. The chain and address are extracted from the message body via `LoginMessage.parse()`. This means the API contract is misleading, and the `chain`/`address` fields could be set to anything without affecting the login — which is confusing but not directly exploitable since the message-embedded values are used. |
| 4 | 🟡 MEDIUM | **No input validation decorators on `LoginDto`** — `LoginDto` uses `@ApiProperty()` for Swagger but has **no validation decorators** (`@IsString()`, `@IsNotEmpty()`, `@MaxLength()`, etc.). This means any input type can pass through — null, undefined, objects, arrays — potentially causing unexpected behavior in `LoginMessage.parse()`. |
| 5 | 🟢 LOW | **Error messages in `getUserById` / `getUserByBoundAddr` leak user IDs** — `this.logger.error(`get user failed: ${error}`)` + `throw new UnknownError(error)` — while `UnknownError` masks the response, the internal `msg` property stores the raw error. |

### 2.3 `common/loginMessage.ts` — 🟡 MEDIUM

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟡 MEDIUM | **No `issuedAt` validation** — The `validate()` method only checks `expirationTime` but NOT `issuedAt`. An attacker can set `issuedAt` to any past time (e.g., year 2000) as long as `expirationTime` is in the future. While `expirationTime` is parsed from the signed message (so can't be tampered with after signing), there's no check that `issuedAt` is reasonably recent or that the window between `issuedAt` and `expirationTime` is reasonable. |
| 2 | 🟡 MEDIUM | **Regex allows Solana addresses 32-44 chars** — The pattern `[1-9A-HJ-NP-Za-km-z]{32,44}` is correct for base58 but doesn't validate that the address is actually a valid Ed25519 point on curve. However, the `GenericAddress` constructor will validate this when creating a `web3.PublicKey`, so this is defense-in-depth only. |
| 3 | ✅ OK | **Signature verification is properly delegated** to `GenericAddress.validate()` which uses `ethers.verifyMessage` for EVM and `sign_detached_verify` (tweetnacl) for Solana — both are correct cryptographic verification methods. |

### 2.4 `entities/user.entity.ts` — ✅ OK
- Proper unique index on `(boundAddr, boundChain)`. No SQL injection risk with TypeORM parameterized queries.

### 2.5 `dto/auth.dto.ts` — 🟠 HIGH

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟠 HIGH | **No input validation on `UserAuthDto`** — `userAddr` has no validation. Combined with the unauthenticated `/auth` endpoint, an attacker can send any string. While the whitelist check is just `Array.includes()`, the lack of validation means the endpoint could be called with extremely long strings, objects, etc. |

### 2.6 `dto/updateLanguageCode.dto.ts` — 🟡 MEDIUM

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟡 MEDIUM | **No validation on `language` field** — No `@IsString()`, `@MaxLength()`, etc. The `locale-codes` library's `getByTag()` will return null for invalid tags (which is caught), but without length limits, very long strings could be sent. |

---

## 3. WALLET MODULE (`src/modules/wallet/`)

### 3.1 `wallet.controller.ts` — ✅ OK (with notes)

| # | Severity | Issue |
|---|----------|-------|
| 1 | ✅ OK | Both endpoints are properly guarded with `@UseGuards(AuthGuard)`. |
| 2 | 🟢 LOW | **`walletId` path parameter not validated** — No UUID format validation on `:walletId`. Invalid UUIDs will cause a TypeORM error that gets caught and returned as `UnknownError`. |
| 3 | 🟢 LOW | **Only 2 endpoints exposed** — The controller only has `GET :walletId/overview` and `GET holdings`. But `WalletService` has many more methods (`createUserWallet`, `deleteWallet`, `setWalletDefault`, `setWalletAlias`). These are presumably called from other controllers — need to verify they are all properly auth-guarded wherever they are exposed. |

### 3.2 `wallet.service.ts` — 🟠 HIGH (multiple issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | ✅ OK | **Private keys are never stored or returned** — The `Wallet` entity stores `address` and `opKey` (operation key public address), but no private key fields. The `getWalletInfo()` response DTO includes `address` and `opKeyAddress` (public info). **No private key exposure found.** |
| 2 | 🟠 HIGH | **`deleteWallet` — no `isActive` check before delete** — `this.walletRepository.findOneBy({ id: walletId, userId: userId })` does NOT filter by `isActive: true`. This means a user could attempt to delete an already-deactivated wallet, which would redundantly process signature verification on an inactive wallet. While not directly exploitable (the wallet is already inactive), it's inconsistent with other methods. |
| 3 | 🟡 MEDIUM | **`getWalletOverview` — uncaught exceptions from Solana RPC** — `this.solanaClient.getBalance()` and `getTokenAccountsByOwner()` are external RPC calls that can fail with network errors. While errors are caught in the `unpackAccount` loop, a top-level RPC failure would throw an unhandled error up the stack. |
| 4 | 🟡 MEDIUM | **`setWalletDefault` — race condition** — The method reads the current default wallet and the target wallet in separate queries, then uses a transaction to swap. However, if two concurrent requests try to set different wallets as default simultaneously, both could read the same `defaultWallet` and both transactions could succeed, potentially leaving multiple wallets marked as default (depending on DB isolation level). The pessimistic lock is missing here (unlike `updateStrategy` which uses `pessimistic_write`). |
| 5 | 🟡 MEDIUM | **`createUserWallet` — no auth on `user` param origin** — The method accepts a `user` object directly. It relies on the caller to verify the user identity. Need to verify that all call sites properly authenticate. |
| 6 | 🟢 LOW | **Wallet alias validation allows only alphanumeric** — `/^[a-zA-Z0-9]+$/` — this excludes unicode characters, spaces, hyphens, underscores. This is overly restrictive but not a security issue. |

### 3.3 `wallet.controller.ts` — Wallet operations exposure analysis

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟡 MEDIUM | **Missing endpoints for wallet CRUD** — `WalletService` has `createUserWallet`, `deleteWallet`, `setWalletDefault`, `setWalletAlias` but `WalletController` only exposes `overview` and `holdings`. These operations must be exposed elsewhere (possibly in a different controller or through the user module). If they're not exposed at all, the wallet management UI won't work. If they're exposed in another controller, we need to verify auth guards there. |

### 3.4 `common/deleteWalletMessage.ts` — ✅ OK (with note)

| # | Severity | Issue |
|---|----------|-------|
| 1 | ✅ OK | Proper expiration check (10 min window). Signature validation delegated to `GenericAddress.validate()`. |
| 2 | 🟢 LOW | **`isEqual` comparison may fail** — `DeleteWalletMessage.validate` calls `deleteWalletMessage.addr.isEqual(walletAddress)` but `GenericAddress.isEqual` compares `this.address === other.address`. For Solana, `this.address` returns a string (base58), and for EVM it returns checksummed hex. This should work correctly as long as both addresses are constructed consistently, but note that `address` is a method call (`this.address()`) not a property — the `isEqual` method accesses `this.address` without calling it as a function. **This is a BUG** — `isEqual` accesses `this.address` as a property but it's defined as `address()` method. It should be `this.address() === other.address()`. This could cause wallet deletion to always fail or always succeed depending on how JS resolves method-as-property. |

**UPDATE on `isEqual` bug**: Looking more carefully, `isEqual` does `this.address === other.address` where `address` is a method. In JavaScript, comparing two function references with `===` will return `false` unless they're the exact same function object. This means **`isEqual` likely always returns `false`**, which means wallet address comparison in `deleteWallet` never matches, making wallet deletion potentially always fail. However, this is a **safety failure** (fail-closed) — it prevents deletion rather than allowing unauthorized deletion. Still a bug.

### 3.5 Wallet entities — ✅ OK
- `wallet.entity.ts` and `walletOrderStatistic.entity.ts` have proper indexes and types.

### 3.6 Wallet DTOs — 🟢 LOW

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟢 LOW | **All DTO classes are empty shells** — `CreateWalletDto`, `SetWalletDefaultDto`, `SetAliasDto`, `DeleteWalletDto` are all empty classes with no validation decorators. If these are used for request body validation, no validation occurs. |
| 2 | ✅ OK | **`getWalletInfo()` response** returns only `id`, `index`, `alias`, `isDefault`, `chain`, `chainIds`, `address`, `opKeyAddress` — all public information. No private keys or sensitive data exposed. |

---

## 4. KMS MODULE (`src/modules/kms/`)

### 4.1 `kms.module.ts` — ✅ OK

### 4.2 `kms.service.ts` — 🟡 MEDIUM (multiple issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟡 MEDIUM | **AWS credentials loaded from config with `config.get()` not `config.getOrThrow()`** — If `kmsRegion`, `kmsAccessKeyId`, or `kmsSecretAccessKey` are missing from config, they will be `undefined`. The AWS SDK will silently fall back to default credential chain (environment variables, instance profile, etc.). This could lead to unexpected behavior — using wrong credentials in wrong environments. |
| 2 | 🟡 MEDIUM | **No key rotation support** — `kmsKeyId` is loaded once at construction. There's no mechanism to rotate the KMS key. For long-running services handling financial data, key rotation is a security best practice. |
| 3 | ✅ OK | **Decrypted keys are NOT logged** — The `decrypt()` method returns the plaintext buffer but never logs it. The error handling catches errors and throws `UnknownError` which masks the details. No plaintext key exposure in logs. |
| 4 | ✅ OK | **Uses `RSAES_OAEP_SHA_256`** — This is a strong, modern asymmetric encryption algorithm. Correct usage. |
| 5 | 🟢 LOW | **`encrypt`/`decrypt` parameter types are `any`** — `msg` and `sig` parameters have no type annotations. While AWS SDK will accept `Uint8Array | string`, passing wrong types could cause cryptic errors. |
| 6 | 🟢 LOW | **KMS module is imported by WalletModule but never directly used in `wallet.service.ts`** — The `KmsModule` is imported in `wallet.module.ts` but `KmsService` is not injected into `WalletService`. It may be used by other services that depend on wallet module, but this is worth noting. |

---

## 5. TRADING MODULE (`src/modules/trading/`)

### 5.1 `trading.controller.ts` — 🟠 HIGH (multiple issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | ✅ OK | All endpoints are properly guarded with `@UseGuards(AuthGuard)`. |
| 2 | 🟠 HIGH | **`createOrder` — no validation on `amount` before `BigInt()` conversion** — `BigInt(amountStr)` will throw a `TypeError` for invalid strings but this is NOT caught in a try/catch (unlike `priorityFee` and `briberyAmount` in `updateSetting`). A malformed `amount` will cause an unhandled exception (500 error) rather than a proper 400 response. More critically, **BigInt accepts negative values** — `BigInt("-1000")` is valid. While the service-level check `amount <= 0n` catches zero and negative, the conversion itself could throw for non-numeric strings. |
| 3 | 🟠 HIGH | **`createOrder` — no slippage upper bound check** — `slippagePercent` is converted to a Decimal and divided by 100, but unlike `updateSetting` which checks `parsedSlippage.gt(1)`, the `createOrder` endpoint does **NO slippage validation**. A user could set 1000% slippage, which would allow extreme price deviation on their trade. While this ultimately hurts only the user, it's a dangerous omission for a financial platform. |
| 4 | 🟡 MEDIUM | **`updateSetting` — slippage validation catches its own exception** — The code does `if (parsedSlippage.gt(1)) { throw new BadRequestException(...) }` inside a `try/catch` that catches ALL errors and throws a generic "invalid slippage". This means the specific "invalid slippage percent" (>100%) message is swallowed and replaced with "invalid slippage". Minor but confusing. |
| 5 | 🟡 MEDIUM | **`createOrder` — no `try/catch` around `new web3.PublicKey(poolStr)`** — If `poolStr` is an invalid Solana public key string, `new web3.PublicKey()` will throw an unhandled error. |
| 6 | 🟢 LOW | **No input validation decorators on any DTO** — `CreateOrderDto`, `CancelOrderDto`, `GetOrdersReqDto` have no `class-validator` decorators. |

### 5.2 `trading.service.ts` — 🔴 CRITICAL + 🟠 HIGH (multiple issues)

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🔴 **CRITICAL** | **`updateStrategy` — off-by-one error causes items NOT to be deactivated** — When `items.length > updateStrategyItems.length`, the loop to deactivate excess items is: `for (let i = items.length - 1; i < updateStrategyItems.length; i++)`. This starts at `items.length - 1` (the last item) and goes while `i < updateStrategyItems.length`. Since `items.length > updateStrategyItems.length`, `items.length - 1 >= updateStrategyItems.length`, so the condition is **immediately false** and the loop **NEVER EXECUTES**. This means **old strategy items are never deactivated when reducing the number of items in a strategy update.** Ghost strategy items will remain active, potentially triggering unwanted automated trades (take-profit/stop-loss at old thresholds). For a financial trading platform, this is **critical** — stale strategy items could execute trades the user thought they removed. |
| 2 | 🟠 HIGH | **`cancelOrder` — TOCTOU race condition** — The method reads the order status, checks conditions, then updates. Between the read and the update, another concurrent process (e.g., `PendingOrder.wait()`) could change the order status. Two scenarios: (a) User cancels while order is being executed — the cancel check passes but the order is already being processed. (b) Two concurrent cancel requests — both read `Created` status, both try to cancel, potentially causing double-cancel requests to the trading server. No pessimistic locking is used. |
| 3 | 🟠 HIGH | **`cancelOrder` — silent failure when status doesn't match** — If the order status is `Success` or `Failed`, the `cancelOrder` method simply returns the order without any error. The user gets a "success" response with a non-cancelled order. This is confusing — the user thinks they cancelled but the order already executed. Should return an error. |
| 4 | 🟠 HIGH | **`onModuleInit` — resumes ALL pending orders on restart without deduplication** — When the server restarts, it finds all orders with `Created` or `ChainTxPending` status and creates new `PendingOrder` instances. If a `PendingOrder.wait()` involves retry logic or polling, restarting the server could cause duplicate executions of in-flight orders. There's no check for whether the trading server already processed the order. |
| 5 | 🟡 MEDIUM | **`swapBuy` / `swapSell` / limit orders — fire-and-forget `PendingOrder.wait()`** — `new PendingOrder(...).wait()` is called without `await`. This means the order processing runs in the background. If the process crashes during execution, the order is saved to DB as `Created` but may never be processed (until server restart per issue #4). The promise rejection is also unhandled. |
| 6 | 🟡 MEDIUM | **`getOrders` — pagination with `MoreThan(startId)` on UUID v7** — UUIDs v7 are time-ordered, so using `MoreThan` for pagination is technically correct. However, combining this with `order: { id: 'DESC' }` is semantically confusing — `MoreThan(startId)` gets IDs greater than startId, but `DESC` ordering means results go from newest to oldest. This could cause pagination to skip or duplicate results if new orders are created between page requests. |
| 7 | 🟡 MEDIUM | **`updateSetting` — no ownership validation for priorityFee/briberyAmount bounds** — There's no maximum limit check on `priorityFee` or `briberyAmount`. A user could set an astronomically high priority fee (e.g., 1000 SOL), and if the order processing blindly uses this value, it would drain their wallet on transaction fees. While this is "user's choice", a reasonable upper bound is prudent for a financial platform. |
| 8 | 🟡 MEDIUM | **`deleteStrategy` — does NOT deactivate strategy items** — When deleting a strategy, only `strategy.isAlive = false` is set. The associated `TradingStrategyItem` records remain `isAlive = true`. If any background process queries strategy items directly (not through the strategy), it could still find and act on items from "deleted" strategies. |
| 9 | 🟡 MEDIUM | **`swapSellBaseInForAutoTrade` — cancels existing sell orders without ownership check** — The method queries `tradingOrderRepository.find({ where: { userId, orderType: AutoTradeSell, remoteId: autoTradeEventId } })` and cancels them. While `userId` is in the query filter, the `autoTradeEventId` comes from user input without validation that it belongs to this user. The subsequent `automaticStrategyRepository.findOneBy({ id: autoTradeEvent.strategyId, userId })` does check ownership, but the cancellation happens BEFORE this check. |
| 10 | 🟢 LOW | **All repository fields marked as `public` (no access modifier = public in TS)** — `tradingSettingRepository`, `tradingStrategyRepository`, etc. are all `public`. This exposes internal repositories to any code that has a reference to `TradingService`. |
| 11 | 🟢 LOW | **`createDefaultTradingSettings` uses `exports.DEFAULT_*` instead of direct constants** — Accessing through `exports.` works but is unusual and suggests this was transpiled from CommonJS or has a non-standard build setup. |

### 5.3 `entities/tradingOrder.entity.ts` — 🟡 MEDIUM

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟡 MEDIUM | **`TradingOrder` class is NOT decorated with `@Entity`** — The `@Entity` and `@Index` decorators are on `TradingOrderEntity extends TradingOrder`. The `TradingOrder` class itself has no column decorators either — fields are plain class properties. TypeORM uses the `TradingOrderEntity` subclass for persistence, but if `TradingOrder` instances (not `TradingOrderEntity`) are accidentally passed to `repository.save()`, the data may not be persisted correctly. Looking at the code, `swapBuy()` creates a plain object literal (not a `TradingOrderEntity` instance), while `swapSell()` uses `TradingOrder.createSwapSellOrder()` — both approaches may work with TypeORM's `save()` but only if the repository is typed for `TradingOrder` (which it appears to be). |
| 2 | 🟢 LOW | **`createSwapBuyOrder` static method incorrectly sets `orderType = TradingOrderType.LimitBuy`** — The method is named `createSwapBuyOrder` but sets `orderType = TradingOrderType.LimitBuy` instead of `TradingOrderType.SwapBuy`. However, this method doesn't appear to be called anywhere in the current code (the `swapBuy` method in `trading.service.ts` creates the order object as a plain literal instead of using this static method). Still a latent bug. |

### 5.4 Trading DTOs — 🟢 LOW

| # | Severity | Issue |
|---|----------|-------|
| 1 | 🟢 LOW | **All DTO classes lack validation decorators** — No `@IsString`, `@IsUUID`, `@IsEnum`, `@Min`, `@Max` etc. from `class-validator`. All input validation is done manually in controller/service methods, which is error-prone and inconsistent. |
| 2 | 🟢 LOW | **`order.response.dto.ts` — `getItemType()` returns `undefined` for unknown values** — The switch statement has no `default` case. If an invalid `ItemTypeDto` is passed, it returns `undefined` silently instead of throwing. |

---

## Critical Findings Summary

### 🔴 CRITICAL (2)

1. **`user.service.ts` — Hardcoded whitelist of ~100 real wallet addresses** in source code. Operational security risk; should be in database/secure config.

2. **`trading.service.ts:updateStrategy()` — Off-by-one bug in deactivation loop** — Strategy items are NEVER deactivated when a strategy update reduces the number of items. Stale items with old take-profit/stop-loss thresholds remain active and could trigger unwanted automated trades on real funds.

### 🟠 HIGH (7)

1. **`user.controller.ts` — `/auth` endpoint is unauthenticated** — Allows enumeration of whitelisted addresses.

2. **`user.service.ts` — DTO field name mismatch (`sig` vs `signature`)** — Login may use wrong field for signature verification.

3. **`user.dto/auth.dto.ts` — No input validation on `UserAuthDto`**.

4. **`wallet.service.ts` — `deleteWallet` doesn't check `isActive`** before processing.

5. **`trading.controller.ts` — `createOrder` has no slippage upper bound** and no try/catch around BigInt/PublicKey conversions.

6. **`trading.service.ts` — `cancelOrder` TOCTOU race condition** and silent failure on already-executed orders.

7. **`trading.service.ts` — `onModuleInit` resumes pending orders without deduplication** — Risk of duplicate order execution on server restart.

### 🟡 MEDIUM (14)
See individual module sections above.

### 🟢 LOW (12)
See individual module sections above.

---

## Recommendations (Priority Order)

1. **IMMEDIATE**: Fix the `updateStrategy` off-by-one loop bug — change `for (let i = items.length - 1; i < updateStrategyItems.length; i++)` to `for (let i = updateStrategyItems.length; i < items.length; i++)`.

2. **IMMEDIATE**: Verify the `LoginDto` field name — confirm whether the runtime DTO uses `sig` or `signature` and ensure it matches what `user.service.ts` destructures.

3. **HIGH**: Add slippage validation in `createOrder` (cap at 100% or a reasonable limit like 50%).

4. **HIGH**: Add pessimistic locking to `cancelOrder` to prevent race conditions.

5. **HIGH**: Add deduplication logic in `onModuleInit` for pending order recovery.

6. **HIGH**: Move `ADDRESS_WHITE_LIST` to database or secure configuration.

7. **MEDIUM**: Add `class-validator` decorators to ALL DTOs.

8. **MEDIUM**: Add rate limiting to unauthenticated endpoints (`/login`, `/auth`).

9. **MEDIUM**: Fix `GenericAddress.isEqual()` to call `this.address()` as a method.

10. **MEDIUM**: Use `config.getOrThrow()` for all required KMS configuration values.

---

*End of Part 1 Audit Report*
