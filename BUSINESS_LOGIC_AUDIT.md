# Business Logic Audit Report
## solagram-backend + btc-assets-api + mystery-bomb-box-backend

**Date:** 2026-04-15  
**Scope:** Fund-critical business logic bugs (security issues excluded — already fixed)

---

## Project 1: solagram-backend (Solana Social Trading)

### BUG-S1: Blink Short Code Lookup Has No URL Validation — Fund Redirection Risk
**Severity: HIGH**  
**File:** `src/modules/blink/blink.service.ts` → `getUrlByShortCode()`  
**Description:** When resolving a short code to a URL, the system retrieves the URL from the database and returns it without validating the URL itself. An attacker who manages to insert a malicious blink URL (e.g., via `findOrInsert` which takes a user-provided `blink` parameter) could redirect users to a phishing/malicious Solana action endpoint that drains their wallet.  
**Impact:** Users clicking on a crafted blink short code could be redirected to a malicious action endpoint that constructs transactions to steal their SOL/tokens.  
**Fix:** Validate that resolved URLs point to trusted/whitelisted action hosts before returning them. Apply the same trusted host filter used in `parseBlinkUrls()`.

---

### BUG-S2: Wallet Connect Relay — Storage Key Collisions Allow Message Spoofing
**Severity: MEDIUM**  
**File:** `src/modules/wallet/wallet.controller.ts` → `connect()`  
**Description:** The `connect` endpoint stores wallet connection data keyed by `encryption_public_key` or `nonce`. There is **no authentication** on the connect callback endpoint. Any caller can POST arbitrary data with a known `nonce`/`encryption_public_key`, overwriting the legitimate wallet connect response in Redis. This means an attacker who knows (or brute-forces) a pending nonce can inject a **fake wallet public key**, causing the frontend to use the wrong key for subsequent operations.  
**Impact:** An attacker could replace the real wallet connect response with spoofed data, potentially causing the user to believe they connected a different wallet. If the app constructs transactions based on the returned `public_key`, funds could be sent to the attacker's address.  
**Fix:** Add a verification mechanism (e.g., HMAC signature on the callback, or one-time token) so only the legitimate Phantom/wallet redirect can supply connection data.

---

### BUG-S3: Solana API Forwarding — Whitelist Bypass via Query String
**Severity: MEDIUM**  
**File:** `src/modules/wallet/wallet.service.ts` → `forwardingSolanaApi()`  
**Description:** The path whitelist (`ALLOWED_PATHS`) checks `path.startsWith(p)` but only blocks `..`, `//`, `@`, and `\\`. An attacker could supply a path like `/v0/trade?url=http://evil.com` or `/v0/trade/../admin` (if the server normalizes the path at the HTTP level before the check). More importantly, for **GET requests**, `input.body` is parsed as JSON and then serialized via `stringify(body, true)` into the query string, which could inject arbitrary parameters. If the upstream API has undocumented admin endpoints under `/v0/trade/...`, they'd be reachable.  
**Impact:** Potentially allows access to unintended upstream API endpoints or injection of crafted parameters.  
**Fix:** Use exact path matching or a stricter regex. Validate and sanitize query parameters independently.

---

### BUG-S4: Cognito User Management — tgUserId Not Validated as Numeric
**Severity: LOW**  
**File:** `src/modules/tg-user/aws-user.service.ts` → `getCognitoResult()`  
**Description:** The `tgUserId` is used directly as the Cognito username (`${tgUserId}`). While Telegram user IDs are numeric, the code does not enforce this. If a crafted JWT or auth bypass occurs, a string-based ID could create collisions or unexpected Cognito users. The cache key also uses `$${tgUserId}` (note the `$` sign), which is inconsistent with other cache keys and could cause cache pollution.  
**Impact:** Low risk of impersonation if an attacker can manipulate the tgUserId field.  
**Fix:** Explicitly validate that `tgUserId` is a positive integer before using it as a Cognito username.

---

### BUG-S5: Encrypted Key Upload — No Encryption Validation
**Severity: MEDIUM**  
**File:** `src/modules/tg-user/db/user-key-encrypted-db.service.ts` → `findOrInsert()`  
**Description:** The `keyEncrypted` field is stored as-is without verifying that it is actually encrypted or that it follows an expected format. An attacker could store plaintext private keys, or conversely, store garbage data to cause errors when the key is later retrieved and used. The DTO `SaveEncryptedKeyInputDto` is an empty class with no validation rules. Additionally, once a key is stored, there is no mechanism to verify the encryption was done client-side with the correct method — the server trusts the client completely.  
**Impact:** If users submit improperly encrypted keys (or plaintext keys), those keys are stored in the database, creating a potential exposure vector if the database is compromised.  
**Fix:** Validate that `keyEncrypted` conforms to an expected encrypted payload format (e.g., check for a known prefix, minimum length, base64 encoding). Add DTO validation decorators.

---

### BUG-S6: `parseBlinkUrls` — Trusted Host Check Bypass via Action Proxy
**Severity: MEDIUM**  
**File:** `src/modules/blink/parse.blink.service.ts` + `src/common/utils/action/action.ts`  
**Description:** `fetchAction()` proxies all requests through `https://proxy.dial.to` and then checks if the **returned domain** is in the trusted host list. However, the actual action URL could be an attacker-controlled URL that the proxy fetches. If the proxy responds with valid JSON containing actions, and the `result.domain` is extracted from the API URL (which the proxy rewrites), the trust check may pass for domains that are not actually trusted if the proxy doesn't perform its own validation. Specifically, if `localhost` or `127.0.0.1` is used, the proxy is bypassed entirely (`shouldIgnoreProxy`), and `_fetch` fetches directly — meaning local network action servers would bypass the trust check entirely.  
**Impact:** In a development/staging environment, untrusted local action servers could be rendered as trusted blinks.  
**Fix:** Ensure the trusted host check compares against the **original** URL's domain, not the API URL post-proxy. Disallow localhost and private IPs in production.

---

## Project 2: btc-assets-api (BTC/RGB++ API)

### BUG-B1: RGB++ Transaction Double-Submission — Queue Deduplication by jobId Only
**Severity: HIGH**  
**File:** `src/services/transaction.ts` → `enqueueTransaction()`  
**Description:** Transactions are enqueued with `jobId: request.txid`. BullMQ's `queue.add()` with a duplicate `jobId` will **silently succeed** and return the existing job (depending on BullMQ version/config). However, if a previous job has **completed or failed and been removed** (via `removeOnComplete`/`removeOnFail`), the same txid can be re-submitted as a **new job**, potentially causing the CKB transaction to be sent twice for the same BTC txid. The `defaultJobOptions` does NOT configure `removeOnComplete`/`removeOnFail` for the transaction queue, so old jobs persist. But the **retry endpoint** allows anyone to retry a failed job, and if the BTC tx is now confirmed, the retry will process and send the CKB tx. If the original tx was also sent (just slowly), this creates a double-spend scenario.  
**Impact:** Potential double-submission of CKB transactions for the same BTC txid, leading to fund loss or inconsistent state.  
**Fix:** Add an on-chain idempotency check before sending the CKB transaction — verify the CKB transaction hasn't already been confirmed for this BTC txid. Add a Redis-based or DB-based deduplication layer.

---

### BUG-B2: Paymaster Cell Drain via Rapid Small Transactions
**Severity: HIGH**  
**File:** `src/services/paymaster.ts` → `getNextCell()` + `appendCellAndSignTx()`  
**Description:** The paymaster cell queue has a finite number of pre-split cells (`PAYMASTER_CELL_PRESET_COUNT`, default 500). Each transaction that requires a paymaster cell consumes one cell from the queue. The `refillCellQueue()` only refills from on-chain UTXOs, which requires the paymaster address to have been funded with correctly-sized cells. **There is no rate limit on how quickly paymaster cells are consumed.** An attacker could submit many valid RGB++ transactions rapidly, each consuming a paymaster cell, draining the queue. While `PAYMASTER_RECEIVE_UTXO_CHECK` exists, it defaults to **false**.  
**Impact:** If paymaster UTXO check is disabled (default), an attacker can drain all paymaster cells without paying any BTC fee, causing all subsequent legitimate transactions to fail with `DelayedError` ("No paymaster cell available").  
**Fix:** **Enable `PAYMASTER_RECEIVE_UTXO_CHECK` by default.** Add per-JWT rate limiting on paymaster cell consumption. Consider requiring a minimum BTC fee always.

---

### BUG-B3: Partial Failure — BTC Confirmed but CKB Send Fails
**Severity: HIGH**  
**File:** `src/services/transaction.ts` → `process()`  
**Description:** The process flow is: (1) verify BTC tx confirmed, (2) append witnesses, (3) optionally append paymaster, (4) send CKB tx, (5) wait for CKB confirmation, (6) mark paymaster cell as spent. If step (4) succeeds (CKB tx sent) but step (5) throws (timeout or RPC error), the paymaster cell is **NOT marked as spent** (the catch block calls `markPaymasterCellAsUnspent`). However, the CKB tx may actually have been committed — it just took too long. On retry, a **new paymaster cell** will be used, and the CKB tx will be sent again with different inputs, likely failing with `TransactionFailedToResolve` since the inputs are already consumed. But the first paymaster cell is now marked as "unspent" and returned to the queue, even though it was actually spent on-chain. This leads to all subsequent users of that cell getting errors.  
**Impact:** Paymaster cells get corrupted (marked available but already spent on-chain), causing cascading failures. Fund loss is possible if the system tries to use spent cells.  
**Fix:** After sending a CKB tx, always check on-chain before marking the paymaster cell status. Use a "pending" state for paymaster cells that have been included in sent transactions. Verify liveness before reusing.

---

### BUG-B4: Cron Job Race Condition — Unlock Cells
**Severity: MEDIUM**  
**File:** `src/routes/cron/unlock-cells.ts` + `src/services/unlocker.ts`  
**Description:** The `unlock-cells` cron endpoint has **no locking mechanism**. If the cron is triggered concurrently (e.g., multiple serverless invocations or manual trigger during scheduled run), `getNextBatchLockCell()` will return the same set of cells to both invocations. Both will try to build and send the same unlock transaction. The second will fail with a CKB error (inputs already consumed), but the first attempt's cells are now in an inconsistent state. There's no distributed lock (Redis lock) around the unlock process.  
**Impact:** Failed unlock transactions, wasted gas, and potential for cells to be left in a broken state if partial processing occurs.  
**Fix:** Add a Redis-based distributed lock around `unlockCells()` to ensure only one instance runs at a time.

---

### BUG-B5: Process-Transactions Cron — Unbounded Worker Concurrency Conflict
**Severity: MEDIUM**  
**File:** `src/routes/cron/process-transactions.ts` + `src/services/transaction.ts`  
**Description:** The transaction processor worker has `concurrency: 10`, and the process-transactions cron starts the worker, waits for `VERCEL_MAX_DURATION - 10` seconds, then pauses and closes. If Vercel triggers a new invocation before the old one finishes pausing, **two workers may be active simultaneously**. While BullMQ handles job locking, the paymaster cell acquisition (`getNextCell`) could result in two workers trying to process different jobs but consuming paymaster cells faster than expected.  
**Impact:** In serverless environments, potential for overlapping workers causing paymaster cell exhaustion.  
**Fix:** Use a Redis-based lock to ensure only one process-transactions worker is active at a time.

---

### BUG-B6: Asset Queries — No Pagination on CKB Indexer Queries
**Severity: LOW**  
**File:** `src/routes/rgbpp/assets.ts`  
**Description:** The asset query endpoints iterate through all `vout` entries of a BTC transaction and query the CKB indexer for each one. For transactions with many outputs, this could result in many indexer queries. The indexer queries use `getTransactions` without pagination limits, which could return large result sets.  
**Impact:** Performance degradation and potential DoS for transactions with many outputs.  
**Fix:** Add pagination limits to indexer queries and cap the number of outputs processed.

---

### BUG-B7: `waitForTranscationConfirmed` — Infinite Recursion Without Timeout
**Severity: MEDIUM**  
**File:** `src/services/ckb.ts` → `waitForTranscationConfirmed()`  
**Description:** This method recursively polls the CKB RPC every 1 second until the transaction is `committed`. There is **no timeout or maximum retry count**. If a CKB transaction is never committed (e.g., it's rejected from the mempool after being accepted, or the network forks), this method will poll forever, blocking the BullMQ worker slot and preventing other jobs from being processed. In serverless, the function will hit the execution timeout, but in long-running deployments, it's a resource leak.  
**Impact:** Worker slots permanently blocked by zombie polling, eventual exhaustion of all 10 concurrent worker slots.  
**Fix:** Add a maximum wait time (e.g., 5 minutes) after which the method rejects with a timeout error.

---

## Project 3: mystery-bomb-box-backend (NFT Blind Box)

### BUG-M1: Mystery Box Creation — No Minimum Amount Validation
**Severity: HIGH**  
**File:** `src/modules/transaction/transaction.service.ts` → `createMysteryBoxTransaction()`  
**Description:** The `amount` parameter comes from user input (via action parameters). While the action UI offers predefined options (0.01, 0.1, 0.5, 1 SOL), the actual HTTP POST can contain **any value**. There is **no server-side validation** that `amount > 0`. A user could pass `amount = 0` or `amount = -1`. With `amount = 0`: `BigInt(0 * LAMPORTS_PER_SOL)` = `0n`, creating a box with 0 SOL. The `verifyAddress` check passes if `balance >= 0`. Later, `distributeAmount(0, N)` would try to distribute 0 SOL among N participants, failing the `totalAmount.lessThan(minAmount.mul(count))` check, **but only at distribution time**, leaving the box stuck in `GRAB_ENDED` state permanently with users' grab amounts locked.  
**Impact:** Users can create 0-SOL boxes. Grabbers pay 1.8x of the box amount (which is 0), so grabbing is free. But the distribution will fail, trapping the system in a broken state. With negative amounts, BigInt would throw, but `amount=0.0001` could create dust boxes.  
**Fix:** Add server-side validation: `if (amount < MIN_AMOUNT) throw`. Set `MIN_AMOUNT` to match the lowest UI option (e.g., 0.01 SOL for dev, 0.1 SOL for prod).

---

### BUG-M2: Grab Mechanism — Predictable "Randomness" via On-Chain Ordering
**Severity: HIGH**  
**File:** `src/modules/transaction/transaction.service.ts` → `distributeBox()` + `distributeAmount()`  
**Description:** The `distributeAmount()` function uses `Decimal.random()` (which uses `Math.random()`) to distribute amounts. **`Math.random()` is not cryptographically secure** and runs on the server, not on-chain. The comment says "generated by on-chain random numbers" but this is **false** — the randomness is generated server-side using `Math.random()`. Furthermore, the "bomb" detection logic (`amount.mul(1000).mod(10).equals(box.bombNumber)`) means the bomb hit is determined by the **last decimal digit** of the randomly assigned amount. Since the server controls the randomness, and `Math.random()` is seeded from a predictable state, the operator could predict or manipulate outcomes.  
The distribution happens in `distributeBox()` which sorts grabs by `confirmedBlockHeight` and `confirmedBlockTxIndex`. A sophisticated attacker who can influence their transaction's position in a block (via timing or fee manipulation) could aim for a specific slot position that avoids the bomb number.  
**Impact:** The fairness claim ("on-chain random numbers") is misleading. An operator with server access could manipulate distribution. Users have no way to verify fairness.  
**Fix:** Use a verifiable random function (VRF) or commit-reveal scheme for the random distribution. At minimum, use `crypto.randomBytes()` instead of `Math.random()` and make the seed publicly verifiable.

---

### BUG-M3: SOL Loss on Failed Distribution Transaction
**Severity: HIGH**  
**File:** `src/modules/transaction/transaction.service.ts` → `distributeBox()` (case `DISTRIBUTE_PENDING`)  
**Description:** When a distribution transaction is pending and `txStatus` is null (not found in mempool), the service re-sends the transaction. If the block height exceeds `txEntity.blockHeight + 150`, it throws an error (tx timeout). However, the box status remains `DISTRIBUTE_INIT` or `DISTRIBUTE_PENDING` — the user funds (grab amounts) are already locked in the submitter's account. There is **no retry logic for timed-out distributions** in the `watch()` loop — `distributeBoxes()` only processes boxes with status `GRAB_ENDED`, `DISTRIBUTE_INIT`, or `DISTRIBUTE_PENDING`. If the throw occurs, the box stays in `DISTRIBUTE_PENDING` **forever** since the error is caught in `watch()` and just logged. The box will be retried on the next `watch()` cycle, but if the blockhash has expired, a new transaction must be created — but the code only re-sends the existing transaction, it never recreates one.  
**Impact:** If a distribution transaction expires (blockhash too old), user funds (both grab amounts and box amount) are permanently locked in the submitter account with no way to recover.  
**Fix:** When a distribution transaction times out, create a new distribution transaction with a fresh blockhash instead of re-sending the expired one. Add an admin recovery mechanism for stuck boxes.

---

### BUG-M4: Grab Count Race Condition — Over-Participation
**Severity: MEDIUM**  
**File:** `src/modules/db/grab-mystery-boxs.service.ts` → `insert()` + `src/modules/transaction/transaction.service.ts` → `grabMysteryBoxsTransaction()`  
**Description:** The grab count check in `GrabMysteryBoxDbService.insert()` counts confirmed grabs (`status >= CONFIRMED`) and rejects if `>= totalBoxCount`. However, **pending grabs are not counted**. If 10 users simultaneously try to grab a box with `openLimit = 5`, the count check may pass for all 10 since none are confirmed yet. All 10 grab transactions are created and submitted. On-chain, all 10 may succeed. The `successGrabMysteryBox` method increments `openCount` and sets `GRAB_ENDED` when `openCount >= openLimit`, but by then more than `openLimit` grabs are confirmed. The excess grabs are handled in distribution (they get refunded), but users experience an unnecessary lock of 1.8x their grab amount for potentially a long time.  
**Impact:** Users can over-participate in a box, getting their funds locked temporarily (until distribution refunds them). The box ends up with more grabs than its limit.  
**Fix:** Count pending AND confirmed grabs in the insert check. Use a Redis-based counter or database lock to enforce the limit atomically.

---

### BUG-M5: Blink Action Parameters — bombNumber Not Validated Server-Side
**Severity: MEDIUM**  
**File:** `src/modules/transaction/transaction.service.ts` → `createMysteryBoxTransaction()`  
**Description:** The `bombNumber` parameter comes from the action input. The action UI specifies `pattern: '^[0-9]$', min: 0, max: 9`, but this is **client-side validation only**. The server does not validate that `bombNumber` is between 0-9. A user could pass `bombNumber = 99` or `bombNumber = -1`. The bomb detection logic is `amount.mul(1000).mod(10).equals(box.bombNumber)` — if `bombNumber > 9`, the mod(10) result can never equal it, meaning **no one ever hits the bomb**. This creates a risk-free box where the creator never wins the 1.8x bomb payout.  
**Impact:** Creator can set an impossible bomb number, guaranteeing all grabbers win their share while the creator gets nothing from bombs. Alternatively, this could be exploited to grief users.  
**Fix:** Add server-side validation: `if (bombNumber < 0 || bombNumber > 9) throw BadRequestException`.

---

### BUG-M6: `failGrabMysteryBox` — Double Commit Instead of Release
**Severity: MEDIUM**  
**File:** `src/modules/db/db.service.ts` → `failGrabMysteryBox()`  
**Description:** In the `finally` block, the code calls `queryRunner.commitTransaction()` instead of `queryRunner.release()`. This means after a rollback (in the catch block), the code tries to commit again, which will either throw an error (transaction already rolled back) or silently succeed if the rollback didn't work. This is a copy-paste bug.  
```typescript
finally {
    await queryRunner.commitTransaction(); // BUG: should be queryRunner.release()
}
```  
**Impact:** Failed grab operations may leave database connections unreleased, leading to connection pool exhaustion over time. In edge cases, a rolled-back transaction might be re-committed.  
**Fix:** Change to `await queryRunner.release()`.

---

### BUG-M7: Watch Loop — No Graceful Shutdown or Error Backoff Scaling
**Severity: LOW**  
**File:** `src/modules/transaction/transaction.service.ts` → `watch()`  
**Description:** The `watch()` method runs an infinite loop with `while(true)`. There is no mechanism to gracefully stop it (no `AbortController`, no flag). The error backoff is fixed at 10s after the second error, but there is no maximum retry count — a persistent error (e.g., Solana RPC down) will cause the loop to log errors every 10 seconds indefinitely. The `errorTimes` counter only resets to 0 on success, meaning a single transient error followed by a persistent one will immediately use the 10s delay.  
**Impact:** Resource waste and log flooding during RPC outages.  
**Fix:** Implement exponential backoff with a maximum delay (e.g., 5 minutes). Add a shutdown mechanism.

---

## Summary Table

| ID | Project | Severity | Bug |
|----|---------|----------|-----|
| BUG-S1 | solagram | HIGH | Blink short code resolves to unvalidated URL — fund redirection |
| BUG-S2 | solagram | MEDIUM | Wallet connect relay has no auth — message spoofing |
| BUG-S3 | solagram | MEDIUM | API forwarding whitelist bypassable via query injection |
| BUG-S4 | solagram | LOW | tgUserId not validated as numeric for Cognito |
| BUG-S5 | solagram | MEDIUM | Encrypted key upload has no format validation |
| BUG-S6 | solagram | MEDIUM | Blink trusted host check bypassable via proxy |
| BUG-B1 | btc-assets-api | HIGH | RGB++ tx double-submission possible after job removal |
| BUG-B2 | btc-assets-api | HIGH | Paymaster cell drain — no rate limit, UTXO check disabled by default |
| BUG-B3 | btc-assets-api | HIGH | Partial failure: paymaster cell marked unspent when actually spent |
| BUG-B4 | btc-assets-api | MEDIUM | Unlock cells cron has no distributed lock — race condition |
| BUG-B5 | btc-assets-api | MEDIUM | Process-transactions cron — overlapping workers in serverless |
| BUG-B6 | btc-assets-api | LOW | Asset queries — no pagination on CKB indexer |
| BUG-B7 | btc-assets-api | MEDIUM | `waitForTranscationConfirmed` infinite poll without timeout |
| BUG-M1 | mystery-box | HIGH | Box creation allows 0/negative SOL — stuck state |
| BUG-M2 | mystery-box | HIGH | "Random" distribution uses `Math.random()`, not on-chain VRF |
| BUG-M3 | mystery-box | HIGH | Distribution tx timeout → permanent fund lockup |
| BUG-M4 | mystery-box | MEDIUM | Grab count race condition — over-participation |
| BUG-M5 | mystery-box | MEDIUM | bombNumber not validated server-side — impossible bomb |
| BUG-M6 | mystery-box | MEDIUM | `failGrabMysteryBox` has commitTransaction in finally instead of release |
| BUG-M7 | mystery-box | LOW | Watch loop — no graceful shutdown or backoff scaling |

**Total: 20 bugs (7 HIGH, 10 MEDIUM, 3 LOW)**
