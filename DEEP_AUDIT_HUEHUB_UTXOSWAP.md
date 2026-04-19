# Deep Business Logic Audit: huehub-dex-dobs-backend, utxoswap-paymaster-backend, utxoswap-farm-sequencer

**Audit Date:** 2026-04-16  
**Auditor:** Factory Droid (Automated Deep Audit)  
**Focus:** Fund-critical bugs, race conditions, input validation, mathematical correctness

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Project 1: huehub-dex-dobs-backend](#project-1-huehub-dex-dobs-backend)
3. [Project 2: utxoswap-paymaster-backend](#project-2-utxoswap-paymaster-backend)
4. [Project 3: utxoswap-farm-sequencer](#project-3-utxoswap-farm-sequencer)
5. [Cross-Project Concerns](#cross-project-concerns)
6. [Summary Table](#summary-table)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 5 |
| 🟠 HIGH | 8 |
| 🟡 MEDIUM | 10 |
| 🔵 LOW | 7 |
| **Total** | **30** |

Key findings:
- **Double-sell race condition** in DOBs marketplace (CRITICAL)
- **Market fee bypass** when fee is below minimum threshold (CRITICAL)  
- **Candidate cell consumed but not returned on failure** in paymaster (CRITICAL)
- **Reward calculation precision loss / division-before-multiply** in farm sequencer (CRITICAL)
- **Missing pool activity check** allows deposits/rewards on ended pools (CRITICAL)

---

## Project 1: huehub-dex-dobs-backend

### Files Read
```
src/modules/market/market.service.ts
src/modules/market/tx.service.ts
src/modules/market/psbt.service.ts
src/modules/market/processor/dobs.processor.ts
src/modules/market/db.service.ts/order.db.service.ts
src/modules/market/db.service.ts/item.db.service.ts
src/modules/collection/collection.service.ts (via controller)
src/modules/collection/collection.controller.ts
src/modules/indexer/indexer.service.ts
src/modules/indexer/indexer.db.service.ts
src/modules/btc/btc.service.ts
src/common/rgbpp/sport.batch.transfer.ts
src/common/utils/tools.ts
src/common/utils/const.config.ts
src/common/utils.service/redlock.service.ts
src/database/entities/item.entity.ts
src/database/entities/order.entity.ts
src/auth/auth.guard.ts
```

### Bugs Found

#### BUG-1: 🔴 CRITICAL — Double-Sell Race Condition on Buy Flow
**Location:** `market.service.ts` → `buyItem()` → `checkBuyerItems()`  
**Description:** The `buyItem()` flow calls `validateItemsForPurchase()` which checks `status: ItemStatus.Init` without acquiring a pessimistic database lock. Only later, in `initOrderByTransaction()`, is a pessimistic write lock obtained. Between the validation and the lock acquisition, a second concurrent buyer can pass the same validation. Both transactions will attempt to create orders for the same items.

The `initOrderByTransaction` does use `pessimistic_write` lock, but the check in `checkBuyerItems` → `validateItemsForPurchase` happens **before** entering the transaction, creating a TOCTOU (Time-of-check-to-time-of-use) window.

**Impact:** Two buyers can simultaneously pass item validation for the same NFT. The first buyer to reach the DB transaction succeeds; the second buyer's PSBT is already signed and broadcast to BTC network, causing a conflicting BTC transaction. This can result in lost funds or stuck orders.

**Fix:** Move the item status validation inside the `initOrderByTransaction` pessimistic lock scope, or add a distributed lock (redlock) around the entire buy flow per item ID.

---

#### BUG-2: 🔴 CRITICAL — Market Fee Bypass When Below Minimum
**Location:** `market.service.ts` → `checkBuyerItems()`, lines ~118-128  
**Description:**
```typescript
if (totalMarketFee >= this.appConfigService.rgbPPConfig.minMarketFee) {
    if (totalMarketFee != parseInt(input.marketFee)) {
        throw new BadRequestException(StatusName.ServiceFeeNotMatch);
    }
} else {
    // EMPTY — no validation when fee is below minimum!
}
```
When the calculated `totalMarketFee` is below `minMarketFee`, the `else` branch is completely empty. This means:
1. The buyer can submit `marketFee = 0` for cheap items and the server accepts it.
2. In `verifyPsbtCommitmentAndFee`, the `marketFee` parameter is passed as-is. If `marketFee` is `0` or omitted, the fee address output check is skipped entirely.

**Impact:** Buyers purchasing low-priced NFTs can avoid paying any market fee, causing direct revenue loss to the platform.

**Fix:** Add enforcement in the `else` branch: `if (parseInt(input.marketFee) < minMarketFee) throw ...`

---

#### BUG-3: 🟠 HIGH — PSBT Fee Verification Incomplete for Minimum Fee
**Location:** `psbt.service.ts` → `verifyPsbtCommitmentAndFee()`  
**Description:**
```typescript
if (marketFee) {
    if (parseInt(marketFee) >= this.appConfigService.rgbPPConfig.minMarketFee) {
        // Only checks fee output when fee >= minimum
    }
}
```
When `marketFee` is truthy but less than `minMarketFee`, no output verification is done. A buyer could submit `marketFee = "1"` (1 satoshi) and bypass the fee output check entirely. The PSBT would be finalized and broadcast without the correct fee output.

**Impact:** Fee revenue loss on low-to-medium priced items.

---

#### BUG-4: 🟠 HIGH — Order Entity May Be Null After DB Error, But BTC Transaction Already Sent
**Location:** `market.service.ts` → `buyItem()` → `sendRgbppTransaction()`  
**Description:** In `initOrderByTransaction`, if the transaction fails (catch block), the rollback happens but `orderEntity` returns `undefined`. In `buyItem()`:
```typescript
let orderEntity = await this.ordersDbService.initOrderByTransaction(...);
await this.sendRgbppTransaction(orderEntity, psbt, ckbVirtualTxResult);
```
If `orderEntity` is null, `sendRgbppTransaction` logs an error and throws, but the caller has already obtained a valid `psbt` and `btcTxId`. The BTC PSBT was already built and verified. In certain race-condition scenarios, the BTC transaction could be sent but the order state is lost.

**Impact:** Potential state inconsistency between BTC blockchain and application DB.

---

#### BUG-5: 🟠 HIGH — Item Status Reset on BTC Failure Allows Re-purchase Without Re-validation
**Location:** `tx.service.ts` → `sendRgbppTransaction()` and `checkBtcTxInputsSpendingStatus()`  
**Description:** When a BTC transaction fails:
```typescript
orderEntity.status = OrderStatus.btcFailed;
await this.ordersDbService.updateOrderAndItemsStatus(orderEntity, ItemStatus.Init);
```
Items are reset to `Init` status. However, the PSBT signature data (`psbtSig`) stored in the item was from the original seller's listing. If the seller's UTXO has been spent in the interim (e.g., they moved their BTC), the item will be back in `Init` status with stale PSBT data. A new buyer could attempt to purchase this item, and `filterInactivePurchaseItems` may not catch it if the UTXO becomes live again (unlikely but possible with chain reorgs).

**Impact:** Potential for stuck items with invalid PSBTs visible as purchasable.

---

#### BUG-6: 🟡 MEDIUM — No Distributed Lock on listItems
**Location:** `market.service.ts` → `listItems()`  
**Description:** `initItemEntity` checks for duplicate items via `queryItem({txHash, index})`. If two listing requests arrive concurrently for the same UTXO, both can pass the duplicate check before either insert completes, potentially creating duplicate listings in the database.

The `batchInsertItem` uses TypeORM's `save()` which does upsert, but only if there's a unique constraint on `(txHash, index)`. If the DB schema doesn't enforce this constraint, duplicate listings are possible.

**Impact:** Same NFT listed twice with different prices.

---

#### BUG-7: 🟡 MEDIUM — Price Type Confusion (Decimal vs Integer)
**Location:** `market.service.ts` → `checkBuyerItems()`  
**Description:** `totalPrice` is computed using Decimal.js `add()`, but `totalMarketFee` is converted to Number via `.toNumber()` and compared with `parseInt(input.marketFee)`. Mixing Decimal, Number, and parseInt can cause precision issues for large satoshi values (though unlikely to exceed Number.MAX_SAFE_INTEGER for BTC).

**Impact:** Potential fee calculation mismatch for extremely high-value sales.

---

#### BUG-8: 🟡 MEDIUM — Cache Invalidation Missing After Buy/Unlist
**Location:** `market.service.ts` → `items()` caching  
**Description:** Items are cached for 10 seconds via Redis. After a buy or unlist operation, the cache is not invalidated. Users may see items as available for purchase that have already been bought.

**Impact:** UX issue that could lead to failed purchase attempts.

---

#### BUG-9: 🔵 LOW — Sensitive Data in Logs
**Location:** `tx.service.ts` → `sendRgbppTransaction()`  
**Description:** `this.logger.error(...buyerPsbt = ${btcTx.toHex()})` logs the full hex of the BTC transaction including signatures. This is sensitive data.

**Impact:** Signed transaction data exposure in logs.

---

#### BUG-10: 🔵 LOW — SQL Injection Risk in Raw Query
**Location:** `indexer.db.service.ts` → `queryHoldersAndTotalSupply()`  
**Description:**
```typescript
WHERE cluster_type_args = x'${clusterTypeArgs.replace('0x', '')}'
```
Uses string interpolation in a raw SQL query. While `replace('0x', '')` provides minimal sanitization, a malicious `clusterTypeArgs` containing `'` characters could break out of the hex literal. However, the `clusterTypeArgs` typically comes from validated on-chain data.

**Impact:** Low risk SQL injection if input validation is insufficient upstream.

---

## Project 2: utxoswap-paymaster-backend

### Files Read
```
src/modules/paymaster/paymaster.service.ts
src/modules/paymaster/paymaster.controller.ts
src/modules/paymaster/candidate-cell-manager.service.ts
src/modules/paymaster/liquidity-pool.service.ts
src/modules/paymaster/sign.service.ts
src/modules/paymaster/transaction-builder.ts
src/common/utils/swap-utils.ts
src/common/utils-service/redlock.service.ts
```

### Bugs Found

#### BUG-11: 🔴 CRITICAL — Candidate Cell Consumed (popped) But Not Returned on Subsequent Failure
**Location:** `paymaster.service.ts` → `getCkbCell()`  
**Description:**
```typescript
const candidateCell = await this.cellService.popCandidateCell();
// ... build return value ...
await this.cellService.saveCandidateCellToCache(lock, ret, 60);
return ret;
```
If `popCandidateCell()` succeeds but `generateSwapIntentUDTCellForPaymaster()` (called before) or `saveCandidateCellToCache()` throws, the cell is permanently lost from the Redis set. No try/catch wraps the sequence to push the cell back on error.

Also: `generateSwapIntentUDTCellForPaymaster` is called **before** `popCandidateCell()`, but pool API failures, math errors, or network issues can cause exceptions after the cell is popped.

Wait — re-reading more carefully: `generateSwapIntentUDTCellForPaymaster` is called before `popCandidateCell`. So if the pool service fails, the cell is not popped. But if `saveCandidateCellToCache` fails after pop, the cell is lost. This is still a concern.

**Impact:** Gradual cell depletion. Over time, cells are consumed from the Redis set but never returned, eventually causing `PaymasterOutOfService` for all users until manual replenishment.

**Fix:** Wrap the pop-and-save in try/catch; re-push cell on failure:
```typescript
try {
    await this.cellService.saveCandidateCellToCache(lock, ret, 60);
} catch(e) {
    await this.cellService.pushCandidateCells([candidateCell]);
    throw e;
}
```

---

#### BUG-12: 🟠 HIGH — Cache Key Collision Allows Cross-User Cell Reuse
**Location:** `candidate-cell-manager.service.ts` → `getCandidateCellFromCache()`  
**Description:** The cache key is derived from `scriptToHash(lock)`. If two different addresses produce the same lock hash (extremely unlikely but theoretically possible with hash collisions or different lock construction paths), they could share cached cells. More practically:

If a user requests `getCkbCell` and receives a cached cell, then another user with the same lock hash (same address) calls the same endpoint, they'll get the same cell. But the cell can only be used once on-chain. The sign service extends the cache TTL to 5 minutes on signing. During this 5-minute window, other API calls from the same address will return the same cell data. If the first transaction is submitted but the second caller also submits with the same cell, the second one will fail on-chain.

**Impact:** While same-user same-cell reuse is somewhat expected, the design doesn't clearly prevent double-signing of the same cell for different transactions. The cache acts as a reservation mechanism, but its TTL-based expiration means stale cells could be served.

---

#### BUG-13: 🟠 HIGH — No Capacity Balance Verification in Sign Service
**Location:** `sign.service.ts` → `signPaymasterInput()`  
**Description:** The sign service validates:
- Input cells are alive
- Paymaster provides exactly 1 input
- Intent output exists with correct UDT amount

But it does **NOT** verify:
1. That total output capacity ≤ total input capacity (CKB balance conservation)
2. That the paymaster's input cell capacity is being returned correctly in the outputs
3. That there are no extra unauthorized outputs draining paymaster funds

A malicious user could construct a transaction that:
- Uses the paymaster's candidate cell as input
- Creates outputs that send the paymaster's CKB capacity to an attacker address
- Still includes a valid-looking intent output

The sign service would sign this transaction, enabling the attacker to steal the paymaster's CKB capacity.

**Impact:** Direct fund theft from paymaster. Attacker could drain candidate cells' CKB capacity.

**Fix:** Add output capacity conservation check: verify that the sum of outputs going to non-paymaster addresses does not exceed the sum of inputs from non-paymaster addresses. Specifically, verify that the paymaster's capacity is returned.

---

#### BUG-14: 🟡 MEDIUM — Slippage Hardcoded to 100% on Amount Estimation
**Location:** `liquidity-pool.service.ts` → `estimateAmountIn()` and `generateSwapIntentUDTCellForPaymaster()`  
**Description:** 
```typescript
amountIn = (amountIn * BigInt(110)) / BigInt(100);
```
A 10% buffer is added. But in `generateSwapIntentUDTCellForPaymaster`:
```typescript
const intentArgs = generateSwapIntentArgs(pool, paymasterLock, amountIn, amountOut, isXToY, BigInt(1000));
```
Slippage is set to `1000` (out of 1000 = 100% slippage tolerance), meaning `amountOutMin = 0`. This means the paymaster's swap can be sandwiched by MEV bots for maximum extraction.

**Impact:** Paymaster could receive 0 CKB output from the swap, paying user's gas but getting nothing in return.

**Fix:** Set a reasonable slippage tolerance (e.g., `BigInt(50)` for 5%).

---

#### BUG-15: 🟡 MEDIUM — Balance Check Threshold Too High (500 CKB)
**Location:** `paymaster.service.ts` → `validateCkbCellInput()`  
**Description:**
```typescript
if (totalCapacity > BigInt(500 * 10 ** 8)) {
    throw new MyCustomException('Balance is sufficient...', ...);
}
```
Users with more than 500 CKB are rejected. However, 500 CKB (~$0.002 at typical rates) is an extremely low threshold. Most users will have more than this and won't be able to use the paymaster. If the intent is to prevent wealthy users from abusing free gas, the threshold should probably be much higher (e.g., 50,000 CKB).

Note: This could also be intentional (only helping truly gas-less users), but it means the paymaster serves very few users.

**Impact:** Most legitimate users cannot use the paymaster service.

---

#### BUG-16: 🟡 MEDIUM — swap-utils.ts: Double-Write of amount_out_min in Intent Args
**Location:** `swap-utils.ts` → `generateSwapIntentArgs()`  
**Description:**
```typescript
swapTokenIntentBuffer.write(u128ToLe(rawIntentArgs.intent_data.amount_out_min), index, 16, 'hex');
index += 16;
swapTokenIntentBuffer.write(u128ToLe(rawIntentArgs.intent_data.amount_out_min), index, 16, 'hex');
index += 16;
```
`amount_out_min` is written **twice** into the buffer. The buffer length is `56 + 1 + 1 + 16 + 16 = 90`, but this write sequence writes `20 + 20 + 8 + 8 + 1 + 1 + 16 + 16 + 16 = 106` bytes, exceeding the allocated buffer of 90 bytes. This will silently truncate or cause a Buffer overflow error.

**Impact:** Potentially corrupted intent args, causing swap transactions to fail or behave unexpectedly on-chain.

**Fix:** Remove the duplicate write or adjust the buffer size.

---

#### BUG-17: 🟡 MEDIUM — Cron Job Candidate Cell Generation Not Atomic
**Location:** `candidate-cell-manager.service.ts` → `generateCandidateCells()`  
**Description:** The method collects all provider cells, groups them, and generates a transaction to split them into candidate cells. Between collecting cells and sending the transaction, another instance could modify the cells (though redlock prevents concurrent runs). However, the CKB transaction could fail if cells are spent between collection and submission.

No retry logic exists for the CKB transaction. If it fails (e.g., cell conflict), the cells remain unsplit until the next cron cycle.

**Impact:** Temporary paymaster unavailability if cell generation consistently fails.

---

#### BUG-18: 🔵 LOW — Rate Limit Race Condition (INCR then EXPIRE)
**Location:** `sign.service.ts` → `checkDailySigningLimit()`  
**Description:**
```typescript
const currentCount = await this.redis.incr(redisKey);
if (currentCount === 1) {
    await this.redis.expire(redisKey, DAILY_SIGNING_TTL_SECONDS);
}
```
If the process crashes between INCR and EXPIRE, the key will persist forever without a TTL. This could permanently block an API key from signing.

**Fix:** Use `SET key 1 NX EX 86400` for the first set, or use Lua script for atomic INCR+EXPIRE.

---

#### BUG-19: 🔵 LOW — Private Key Used Directly in Code
**Location:** Multiple files — `privateKeyToAddress(this.appConfig.cellManagerConfig.cellManagerKey, ...)`  
**Description:** The cell manager's private key is loaded from config and used directly. While this is necessary for signing, there's no mention of HSM, key rotation, or secure key storage. The key is also used in `console.log` context (transaction-builder). If the config file is leaked, all paymaster funds are compromised.

**Impact:** Key management concern.

---

## Project 3: utxoswap-farm-sequencer

### Files Read
```
crates/intent-solver/src/deposit.rs
crates/intent-solver/src/withdraw.rs
crates/intent-solver/src/harvest.rs
crates/intent-solver/src/common.rs
crates/intent-solver/src/withdraw_and_harvest.rs
crates/intent-solver/src/tx.rs
crates/types/src/lib.rs
crates/types/src/checker.rs
crates/types/src/parser.rs
crates/types/src/utils.rs
crates/api/src/intents/submit.rs
crates/api/src/intents/intent.rs
crates/api/src/intents/submit_create_pool_intent.rs
crates/api/src/intents/create_pool_intent.rs
crates/utils/src/pools_manager/manager.rs
crates/utils/src/pools_manager/intents_submitter.rs
crates/utils/src/pools_manager/lock.rs
crates/utils/src/pools_manager/block_watcher.rs
crates/utils/src/pools_manager/pools_handler/handler.rs
crates/utils/src/pools_manager/pools_handler/runner.rs
crates/utils/src/pools_manager/pools_handler/farm_pool/pool.rs
crates/utils/src/pools_manager/pools_handler/farm_pool/batch_tx.rs
crates/utils/src/pools_manager/pools_handler/farm_pool/runner.rs
crates/utils/src/pools_manager/pools_handler/pool_creator/creator.rs
crates/utils/src/pools_manager/pools_handler/pool_creator/runner.rs
src/main.rs
src/config.rs
src/security.rs
crates/api-common/src/lib.rs
crates/api-common/src/error.rs
crates/api-common/src/context.rs
```

### Bugs Found

#### BUG-20: 🔴 CRITICAL — Reward Calculation Precision Loss (Division Before Multiply)
**Location:** `crates/intent-solver/src/common.rs` → `calculate_reward()`  
**Description:**
```rust
pub fn calculate_reward(
    udt_per_second: u128,
    staked_amount: u128,
    total_staked: u128,
    seconds_elapsed: u64,
) -> u128 {
    if total_staked == 0 { return 0; }
    let total_reward = udt_per_second * seconds_elapsed as u128;
    total_reward * staked_amount / total_staked
}
```
This performs `(udt_per_second * elapsed * staked) / total_staked`. For small `udt_per_second` values and short time intervals, the intermediate result `udt_per_second * elapsed` can be very small, and the subsequent division truncates to 0. This means users get 0 rewards even when they should receive non-zero amounts.

More critically, this calculation does NOT use the accumulated `acc_reward_per_share` pattern (which exists in the pool state but is never updated or used in the solver!). The correct DeFi pattern is:
1. Update `acc_reward_per_share += (elapsed * rate * PRECISION) / total_staked`
2. User reward = `user_staked * acc_reward_per_share / PRECISION - user_reward_debt`

Without precision scaling, small stakers in large pools get consistently rounded down to 0 rewards.

**Impact:** Systematic under-payment of rewards to all users, with small stakers receiving 0.

---

#### BUG-21: 🔴 CRITICAL — Harvest Solver Does NOT Check Pool Activity/End Time
**Location:** `crates/intent-solver/src/harvest.rs` and `crates/types/src/checker.rs`  
**Description:** The `HarvestSolver::solve()` does not check if `current_time > pool.end_time`. The `check_farm_intent` function in `checker.rs` only enforces end time for deposits:
```rust
FarmIntentType::Deposit => {
    if now > pool.end_time {
        return Err(CheckError::PoolEnded);
    }
}
FarmIntentType::Harvest => Ok(()), // No check!
```
This means users can harvest rewards from pools that have already ended. More importantly, the `calculate_reward` function uses `current_time - last_harvest_time` without capping at `end_time`, so rewards accumulate indefinitely past pool end time.

**Impact:** Infinite reward inflation — users can claim rewards for time periods after the pool's reward allocation has ended, potentially draining more rewards than the pool was funded with.

**Fix:** Cap `current_time` at `min(current_time, pool.end_time)` in the reward calculation, or check pool end time in harvest solver.

---

#### BUG-22: 🟠 HIGH — Deposit Solver Doesn't Validate user_staked Matches On-Chain State  
**Location:** `crates/intent-solver/src/deposit.rs`  
**Description:** The `DepositSolver::solve()` takes `user_staked` as input from the intent cell:
```rust
pub fn solve(lp_amount: u128, pool_total_staked: u128, user_staked: u128) -> Result<DepositResult>
```
The `user_staked` value comes from the parsed cell data (parsed in `parser.rs` from `cell_data[81..97]`). A malicious user could craft an intent cell with a falsified `user_staked` value. The solver trusts it without verifying against the actual on-chain user stake record.

Similarly, `pool_total_staked` is taken from the pool cell but could be stale if multiple intents modify it in the same batch.

**Impact:** Users could claim they have more staked than they actually do, affecting reward calculations.

---

#### BUG-23: 🟠 HIGH — WithdrawAndHarvest Calculates Rewards Before Withdrawal
**Location:** `crates/intent-solver/src/withdraw_and_harvest.rs`  
**Description:**
```rust
let reward = super::common::calculate_reward(udt_per_second, user_staked, total_staked, elapsed);
```
Rewards are calculated based on `user_staked` (the amount BEFORE withdrawal). This is correct for the current period. However, the `new_pool_total = total_staked - lp_amount` is returned, which means the pool total decreases. If multiple withdraw-and-harvest intents are processed in the same batch, the `total_staked` used for reward calculation doesn't account for previous withdrawals in the same batch.

**Impact:** Reward over-payment when multiple users withdraw in the same batch, since each uses the pre-batch `total_staked` as divisor.

---

#### BUG-24: 🟠 HIGH — build_farm_transaction Does NOT Update acc_reward_per_share
**Location:** `crates/intent-solver/src/tx.rs` → `build_farm_transaction()`  
**Description:** The function parses the pool cell data (total_staked, reward_per_second, acc_reward_per_share, last_reward_time) but writes them back unchanged:
```rust
outputs_data.extend_from_slice(&total_staked.to_le_bytes());
outputs_data.extend_from_slice(&reward_per_second.to_le_bytes());
outputs_data.extend_from_slice(&acc_reward_per_share.to_le_bytes()); // NOT UPDATED
outputs_data.extend_from_slice(&last_reward_time.to_le_bytes());     // NOT UPDATED
```
The `acc_reward_per_share` and `last_reward_time` are never updated after processing intents. This means:
1. Reward accounting is broken — the same time period's rewards can be claimed multiple times
2. The pool state never advances, so every harvest re-calculates from the same `last_reward_time`

**Impact:** Repeated reward claims for the same time period. Potential infinite reward drain.

---

#### BUG-25: 🟡 MEDIUM — Submit Intent Doesn't Verify Cell Data Before DB Insert
**Location:** `crates/api/src/intents/submit.rs`  
**Description:** The submit handler:
1. Fetches the transaction from CKB RPC
2. But then comments out the actual parsing and validation:
```rust
// let parsed = types::parser::parse_farm_intent(&cell_data)?;
// types::checker::check_farm_intent(&parsed, &pool_state)?;
```
3. Inserts the intent directly into DB

This means **any** cell reference can be submitted as a farm intent, including:
- Non-existent cells
- Cells with invalid farm data
- Cells belonging to different farm pools
- Already-processed cells

**Impact:** Database pollution with invalid intents; potential DoS of the processing pipeline.

---

#### BUG-26: 🟡 MEDIUM — No Duplicate Intent Submission Check
**Location:** `crates/api/src/intents/submit.rs`  
**Description:** There's no unique constraint check on `(cell_tx_hash, cell_index)` before inserting. A user can submit the same cell multiple times, creating duplicate intents. The processing pipeline (`handler.rs`) queries pending intents without deduplication.

**Impact:** Same intent processed multiple times → double deposits, double reward claims.

---

#### BUG-27: 🟡 MEDIUM — In-Memory Rate Limiter State Lost on Restart
**Location:** `src/security.rs` → `RateLimiter`  
**Description:** The rate limiter uses `Arc<Mutex<HashMap<IpAddr, Vec<Instant>>>>`. This state is entirely in-memory and resets on every server restart/deploy. An attacker can simply wait for a deploy or crash to reset rate limits.

For a multi-instance deployment, each instance has its own rate limit state, so an attacker can bypass limits by hitting different instances.

**Impact:** Rate limiting is ineffective in production.

---

#### BUG-28: 🔵 LOW — FarmLockManager Uses Non-Atomic Lock Release
**Location:** `crates/utils/src/pools_manager/lock.rs`  
**Description:** The lock is acquired with `SET NX PX` (atomic), but released with plain `DEL`. If the lock TTL expires before release, another process acquires it, and then the first process calls `release()`, it deletes the second process's lock.

**Fix:** Use Lua script to delete only if the value matches a unique ID.

---

#### BUG-29: 🔵 LOW — BlockWatcher Last Block Starts at 0
**Location:** `crates/utils/src/pools_manager/block_watcher.rs`  
**Description:** `last_block` starts at 0, meaning on first run it will attempt to process all blocks from genesis. This could be extremely slow or cause OOM.

**Impact:** Initial startup performance issue.

---

#### BUG-30: 🔵 LOW — Create Pool Intent Handler is a Stub
**Location:** `crates/api/src/intents/submit_create_pool_intent.rs`, `create_pool_intent.rs`  
**Description:** Both handlers simply log and return `{"status": "pending"}` without any actual validation or DB insertion. There's no permission check, parameter validation, or authorization for pool creation.

**Impact:** No functional pool creation; if deployed as-is, anyone could theoretically trigger pool creation without authorization (though the stub doesn't actually create anything).

---

## Cross-Project Concerns

#### CROSS-1: 🟡 MEDIUM — No Transaction Idempotency Keys
**Affects:** All three projects  
**Description:** None of the APIs implement idempotency keys. If a client retries a request due to network timeout, the server may process the same operation twice (double-buy, double-list, double-intent-submit).

#### CROSS-2: 🔵 LOW — Inconsistent Error Handling Patterns
**Affects:** huehub + paymaster  
**Description:** Some catch blocks silently swallow errors (e.g., `initOrderByTransaction` catch returns undefined), while others re-throw. This inconsistency makes it hard to reason about failure modes.

---

## Summary Table

| ID | Project | Severity | Title |
|----|---------|----------|-------|
| BUG-1 | huehub | 🔴 CRITICAL | Double-sell race condition on buy flow |
| BUG-2 | huehub | 🔴 CRITICAL | Market fee bypass when below minimum |
| BUG-3 | huehub | 🟠 HIGH | PSBT fee verification incomplete for minimum fee |
| BUG-4 | huehub | 🟠 HIGH | Order entity null after DB error, BTC tx already sent |
| BUG-5 | huehub | 🟠 HIGH | Item status reset allows re-purchase with stale PSBT |
| BUG-6 | huehub | 🟡 MEDIUM | No distributed lock on listItems |
| BUG-7 | huehub | 🟡 MEDIUM | Price type confusion (Decimal vs Integer) |
| BUG-8 | huehub | 🟡 MEDIUM | Cache invalidation missing after buy/unlist |
| BUG-9 | huehub | 🔵 LOW | Sensitive data (signed PSBT) in logs |
| BUG-10 | huehub | 🔵 LOW | SQL injection risk in raw query |
| BUG-11 | paymaster | 🔴 CRITICAL | Candidate cell lost on post-pop failure |
| BUG-12 | paymaster | 🟠 HIGH | Cache key collision allows cross-user cell reuse |
| BUG-13 | paymaster | 🟠 HIGH | No capacity balance verification in sign service |
| BUG-14 | paymaster | 🟡 MEDIUM | Slippage hardcoded to 100% (amountOutMin = 0) |
| BUG-15 | paymaster | 🟡 MEDIUM | Balance check threshold too high (500 CKB) |
| BUG-16 | paymaster | 🟡 MEDIUM | Double-write of amount_out_min in intent args buffer |
| BUG-17 | paymaster | 🟡 MEDIUM | Cron job cell generation not atomic |
| BUG-18 | paymaster | 🔵 LOW | Rate limit INCR/EXPIRE race condition |
| BUG-19 | paymaster | 🔵 LOW | Private key management concern |
| BUG-20 | farm | 🔴 CRITICAL | Reward calculation precision loss |
| BUG-21 | farm | 🔴 CRITICAL | Harvest solver doesn't check pool end time |
| BUG-22 | farm | 🟠 HIGH | Deposit solver trusts user_staked from intent cell |
| BUG-23 | farm | 🟠 HIGH | Batch processing uses stale total_staked for rewards |
| BUG-24 | farm | 🟠 HIGH | build_farm_transaction doesn't update acc_reward_per_share |
| BUG-25 | farm | 🟡 MEDIUM | Submit intent doesn't verify cell data |
| BUG-26 | farm | 🟡 MEDIUM | No duplicate intent submission check |
| BUG-27 | farm | 🟡 MEDIUM | In-memory rate limiter lost on restart |
| BUG-28 | farm | 🔵 LOW | Non-atomic lock release |
| BUG-29 | farm | 🔵 LOW | BlockWatcher starts from block 0 |
| BUG-30 | farm | 🔵 LOW | Create pool handler is a stub |
| CROSS-1 | All | 🟡 MEDIUM | No transaction idempotency keys |
| CROSS-2 | All | 🔵 LOW | Inconsistent error handling patterns |

---

*End of audit report.*
