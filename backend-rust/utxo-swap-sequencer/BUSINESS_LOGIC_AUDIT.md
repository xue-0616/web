# Deep Business Logic Audit: utxo-swap-sequencer

**Date:** 2026-04-15  
**Scope:** Core business logic — AMM math, intent processing, transaction building, pool management  
**Focus:** Bugs that could cause fund loss, incorrect swap amounts, or economic exploitation  

---

## Executive Summary

This audit focuses exclusively on the **core business logic** of the CKB DEX matching engine, following a prior security audit that addressed auth/CORS/injection issues. The codebase shows evidence of a previous security remediation pass (BigUint migration, checked arithmetic, lock ownership, etc.). This audit identifies **residual and newly-discovered business logic bugs** that survive the remediation.

**Critical (fund loss): 3 | High (economic exploit): 5 | Medium (logic error): 6 | Low (correctness): 4**

---

## CRITICAL — Direct Fund Loss Risk

### BL-C1: Swap Output Type Script Args Are Wrong — Users Receive Invalid/Wrong Tokens
- **Files:** `crates/intent-solver/src/lib.rs`, lines in `process_single_intent()` (SwapExactInputForOutput and SwapInputForExactOutput branches)
- **Code:**
  ```rust
  output_token_type_script: CkbScript {
      code_hash: intent.asset_y_type_hash,
      hash_type: 1,
      args: intent.asset_y_type_hash.to_vec(), // BUG: type_hash ≠ type_script args
  },
  ```
- **Bug:** The output token's `type_script.args` is set to `intent.asset_y_type_hash` (a 32-byte type hash). On CKB, UDT type scripts use `args` to encode the **owner lock hash** or other token-specific parameters — NOT the type hash itself. The type hash is a *derived value* (blake2b of the serialized type script), never used as args.
- **Impact:** Every swap output cell has an incorrect type script. The CKB on-chain type script validation will either:
  1. **Reject the transaction** (best case — user's swap fails, funds stuck in processing)
  2. **Create a cell with a non-existent token type** — user receives worthless cells instead of real tokens. The real tokens remain in the pool, effectively stolen.
- **Affected operations:** ALL swaps (both exact-input and exact-output)
- **Root cause:** The code comment says "M-5: use actual type script args" but uses the wrong value. The actual type script args should be parsed from the pool configuration or from the intent cell's on-chain type script metadata.
- **Fix:** Store the full `type_script` (including correct args) for asset_x and asset_y in `PairInfo` or `ParsedIntent`. Use `pool.asset_y_type_script.args.clone()` instead of `intent.asset_y_type_hash.to_vec()`.

### BL-C2: LP Token and Burn Output Type Script Args Are Similarly Wrong
- **Files:** `crates/intent-solver/src/lib.rs`, AddLiquidity and RemoveLiquidity branches
- **Code (AddLiquidity):**
  ```rust
  lp_token_type_script: CkbScript {
      code_hash: pair.pool_type_hash,
      hash_type: 1,
      args: pair.pool_type_hash.to_vec(), // BUG: pool_type_hash ≠ LP token args
  },
  ```
- **Code (RemoveLiquidity):**
  ```rust
  asset_x_type_script: CkbScript {
      code_hash: intent.asset_x_type_hash,
      hash_type: 1,
      args: intent.asset_x_type_hash.to_vec(), // Same bug
  },
  ```
- **Bug:** Same pattern as BL-C1. All output cells (LP tokens from add-liquidity, returned assets from remove-liquidity) use the type hash as the args field, which is incorrect.
- **Impact:** All add-liquidity and remove-liquidity operations produce cells with wrong type scripts. Users either lose funds or receive worthless cells.
- **Fix:** Same as BL-C1 — use the actual type script args from pool configuration.

### BL-C3: Swap Exact Output — Excess Input Not Refunded to User
- **File:** `crates/intent-solver/src/lib.rs`, `SwapInputForExactOutput` branch
- **Code:**
  ```rust
  let required_in = calculate_swap_exact_output(...)?;
  if required_in > intent.amount_in {
      return Err(IntentErrorReason::IntentNotFulfilled);
  }
  // ... reserves updated with `required_in`
  Ok(IntentEvent::Swap(SwapEvent {
      amount_in: required_in,  // Only the required amount
      amount_out: intent.min_amount_out,
      ...
  }))
  ```
  But in `tx.rs` `build_swap_output()`:
  ```rust
  fn build_swap_output(event: &SwapEvent, _intent_cells: &[Cell]) -> (CellOutput, Vec<u8>) {
      let udt_amount_le = event.amount_out.to_le_bytes();
      (CellOutput { ... lock: event.user_lock_script.clone(), ... }, udt_amount_le.to_vec())
  }
  ```
- **Bug:** When `required_in < intent.amount_in`, the difference (`intent.amount_in - required_in`) represents **excess input tokens that belong to the user**. The solver correctly updates reserves with only `required_in`, but the transaction builder creates only ONE output cell per swap (the output token). There is **no change/refund cell** for the excess input tokens.
- **Impact:** If a user submits a swap-input-for-exact-output with `amount_in = 1000` but only `required_in = 800` is needed, the remaining 200 tokens are absorbed by the pool — stolen from the user.
- **Severity:** Critical when `amount_in` significantly exceeds `required_in`.
- **Fix:** Add a refund/change output cell in `build_swap_output()` when `event.amount_in < intent.amount_in`. The change cell should return `intent.amount_in - event.amount_in` of the input token to the user's lock script.

---

## HIGH — Economic Exploitation Risk

### BL-H1: Rounding Profit Extraction via Repeated Small Swaps (1-Wei Attack)
- **File:** `crates/intent-solver/src/lib.rs`, `calculate_swap_exact_input()`
- **Formula:** `amount_out = (amount_in * (10000 - fee_rate) * reserve_out) / (reserve_in * 10000 + amount_in * (10000 - fee_rate))`
- **Bug:** With BigUint integer division (floor), when `amount_in = 1`:
  - `fee_adjusted = 1 * 9970 = 9970`
  - `numerator = 9970 * reserve_out`
  - `denominator = reserve_in * 10000 + 9970`
  - For typical pools (reserve_in = reserve_out = 10^18): `amount_out = 9970 * 10^18 / (10^22 + 9970) ≈ 0`
  
  So a swap of 1 produces 0 output, but `reserve_in` still increases by 1 and `reserve_out` decreases by 0. The **pool invariant k = x * y increases** because `x` increased while `y` stayed the same.
  
  However, the check `if amount_out < intent.min_amount_out` would reject this if `min_amount_out > 0`. The checker requires `min_amount_out > 0` (in `check_intent`).
  
  **But:** The checker validates `min_amount_out > 0` at the API level, while the solver only checks `amount_out < intent.min_amount_out`. If a malicious intent is directly inserted into the DB (bypassing API validation) with `min_amount_out = 0`, the swap succeeds with `amount_out = 0`, and the pool accumulates dust.
- **Impact:** While the API checker prevents `min_amount_out = 0`, the defense-in-depth principle is violated. The solver should independently reject `amount_out == 0`.
- **Fix:** Add to `calculate_swap_exact_input()`:
  ```rust
  if result == BigUint::from(0u32) {
      return Err(AmmError::ZeroInput);  // or a new ZeroOutput error
  }
  ```

### BL-H2: `calculate_add_liquidity` — LP Amount Rounding Favors Attacker in Existing Pool
- **File:** `crates/intent-solver/src/lib.rs`, `calculate_add_liquidity()`
- **Code:**
  ```rust
  let lp_from_x = to_big(amount_x) * to_big(total_lp) / to_big(reserve_x);
  let lp_from_y = to_big(amount_y) * to_big(total_lp) / to_big(reserve_y);
  
  if lp_from_x <= lp_from_y {
      let actual_y = &lp_from_x * to_big(reserve_y) / to_big(total_lp);
      // ...
      Ok((amount_x, y_val, lp_val))
  }
  ```
- **Bug:** The `actual_y` calculation uses the already-rounded-down `lp_from_x`. This means the user gets LP tokens based on `lp_from_x` (rounded down), but pays `actual_y` which is *also* rounded down. The user pays slightly less Y than proportional, but the LP tokens are also slightly less. However, when the user later removes liquidity, the LP-to-reserve ratio has shifted slightly in their favor due to accumulated rounding from all previous add/remove operations. Over many operations with small amounts, this creates a consistent bias.
- **More critically:** The function returns `(amount_x, y_val, lp_val)` — the *full* `amount_x` even though the LP was calculated based on the proportion. If `lp_from_x < lp_from_y`, the pool receives `amount_x` of asset X, but only `actual_y < amount_y` of asset Y. The excess `amount_y - actual_y` that the user submitted in their intent cell is **not refunded** — it's stuck in the intent cell consumed by the batch transaction.
- **Impact:** Medium fund loss on every proportionally-imbalanced add-liquidity.
- **Fix:** The function should also return the actual amounts consumed so the transaction builder can create refund cells for unused tokens.

### BL-H3: Batch Processing Fails Entirely on Single Checked_add Overflow — All Users' Intents Affected
- **File:** `crates/utils/src/liquidity_pairs/batch_tx.rs`, `build_batch_swap_tx()`
- **Code:**
  ```rust
  current_x = current_x.checked_add(intent.amount_in)
      .ok_or_else(|| anyhow::anyhow!("Reserve overflow"))?;
  ```
- **Bug:** If any single intent in the batch causes a `checked_add` overflow (unlikely but possible with very large token amounts), the `?` operator propagates the error, causing `build_batch_swap_tx()` to return `Err(...)`. In `process_pool_batch()`, this error is caught by the outer `if let Err(e)` and logged, but **all intents in the batch have already been marked as Processing** (by the `mark_processing` call). They are never rolled back to Pending.
- **Impact:** A single malicious or extremely large intent can DOS all other users' intents for that pool, permanently stuck in "Processing" status. Users' funds are locked in intent cells that will never be processed or refunded.
- **Fix:** Process `build_batch_swap_tx` failures by marking all intents as `Failed` with the error reason. Alternatively, catch the error per-intent (refund that intent, continue batch).

### BL-H4: `remove_liquidity.rs` vs `lib.rs` — Duplicate, Divergent Remove Liquidity Logic
- **Files:** `crates/intent-solver/src/remove_liquidity.rs` vs `crates/intent-solver/src/lib.rs` `calculate_remove_liquidity()`
- **Bug:** Two different implementations of remove liquidity calculation exist:
  - **`lib.rs`:** Uses BigUint: `amount_x = to_big(lp_amount) * to_big(reserve_x) / to_big(total_lp)`
  - **`remove_liquidity.rs`:** Uses checked_mul: `asset_x = lp_amount.checked_mul(pair.asset_x_reserve).map(|v| v / pair.total_lp_supply)`
  
  For large values where `lp_amount * reserve_x` exceeds `u128::MAX`:
  - `lib.rs` succeeds (BigUint handles arbitrary precision)
  - `remove_liquidity.rs` returns `InsufficientLiquidity` (checked_mul overflows)
  
  It's unclear which code path is actually used in production. If `remove_liquidity.rs` is used, valid remove-liquidity operations with large amounts will incorrectly fail.
- **Impact:** Users with large LP positions may be unable to remove liquidity.
- **Fix:** Remove the duplicate. Use the BigUint version from `lib.rs` exclusively.

### BL-H5: `solve_batch` Truncates Intents Without Feedback — Excess Intents Remain Pending Indefinitely
- **File:** `crates/intent-solver/src/lib.rs`, `solve_batch()`
- **Code:**
  ```rust
  let batch = if intents.len() > MAX_BATCH_SIZE {
      &intents[..MAX_BATCH_SIZE]
  } else {
      intents
  };
  ```
  But in `crates/utils/src/liquidity_pairs/manager.rs`:
  ```rust
  let batch_size = pool_intents.len().min(MAX_BATCH_SIZE);
  let batch = pool_intents.into_iter().take(batch_size).collect::<Vec<_>>();
  ```
- **Bug:** The batch size is truncated at two levels — once in the manager and once in the solver. The manager already limits to `MAX_BATCH_SIZE`, but both truncations mean if the manager passes exactly `MAX_BATCH_SIZE` intents, the solver may still truncate to `MAX_BATCH_SIZE` again (which is a no-op). The real issue is: **intents beyond `MAX_BATCH_SIZE` are never marked as Processing**. They remain Pending and will be re-fetched on the next cycle. But the next cycle will fetch them again along with new intents, and if new intents keep arriving faster than `MAX_BATCH_SIZE` per cycle, older intents can be **starved** — never processed.
- **Impact:** Under high load, some users' intents could be delayed indefinitely (livelock starvation).
- **Fix:** The manager should fetch intents `ORDER BY created_at ASC LIMIT MAX_BATCH_SIZE` (which it already does with `order_by_asc`), ensuring FIFO. This is actually fine. The real fix needed is: since `take(batch_size)` in the manager already limits, the solver's truncation is redundant. Remove one to avoid confusion. Also add monitoring/alerting for queue depth.

---

## MEDIUM — Logic Errors

### BL-M1: `constant_time_eq` Short-Circuits on Length — Timing Side Channel
- **File:** `crates/api/src/external/swap_utxo_global.rs`
- **Code:**
  ```rust
  fn constant_time_eq(a: &str, b: &str) -> bool {
      if a.len() != b.len() {
          return false;  // BUG: reveals length via timing
      }
      a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
  }
  ```
- **Bug:** The length comparison is not constant-time. An attacker can determine the API key length by measuring response times. Once length is known, a byte-by-byte brute force is not possible (the fold IS constant-time for same-length strings), but knowing the key length still reduces the search space.
- **Impact:** Low — API key length leaked via timing.
- **Fix:** Pad both strings to max length before comparing, or always iterate the same number of times.

### BL-M2: `process_pool_batch` Marks ALL Batch Intents as Processing BEFORE Solver Runs — But Solver May Refund Some
- **File:** `crates/utils/src/liquidity_pairs/manager.rs`
- **Code flow:**
  1. `solve_batch()` runs → produces `solver_result` with `refunded` intents
  2. `update_many().filter(id IN intent_ids).set(Processing)` — marks ALL intents as Processing
  3. `update_many().filter(id IN refunded_ids).set(Refunded)` — then re-marks refunded ones
  
- **Bug:** There's a brief window where refunded intents are in `Processing` state. If the sequencer crashes between step 2 and step 3, refunded intents are permanently stuck in `Processing`.
- **Impact:** On crash, some intents meant for refund stay stuck in Processing. User funds locked.
- **Fix:** Mark refunded intents directly as `Refunded` in step 2 by splitting the update into two sets from the start. Or use a database transaction wrapping both updates.

### BL-M3: `fee_rate` Is `u64` in `PairInfo` but Treated as `u128` in Calculations
- **File:** `crates/intent-solver/src/lib.rs`
- **Code:**
  ```rust
  pub fee_rate: u64,  // In PairInfo
  // ...
  let fee_adjusted = to_big(amount_in) * to_big(10000u128.saturating_sub(fee_rate_bps as u128));
  ```
  And:
  ```rust
  let fee_amount = intent.amount_in.checked_mul(pair.fee_rate as u128)
      .and_then(|v| v.checked_div(10000))
      .unwrap_or(0);
  ```
- **Bug:** `fee_rate` is `u64` (max ~1.8 × 10^19). When cast to `u128` for `saturating_sub(fee_rate_bps as u128)`, if `fee_rate > 10000`, then `10000u128.saturating_sub(fee_rate_bps as u128)` saturates to 0, making `fee_adjusted = 0`, making `amount_out = 0` for any swap. This is arguably correct behavior (100%+ fee means no output), but if `fee_rate` is corrupted or set maliciously in the on-chain pool data, all swaps produce 0 output and are refunded.
- **More insidiously:** `fee_amount = amount_in * fee_rate / 10000` — if `fee_rate` is e.g. 20000, `fee_amount = amount_in * 2`, which may overflow with `checked_mul`. The `unwrap_or(0)` then reports `fee_amount = 0` in the event — an incorrect fee amount for accounting/display.
- **Impact:** Wrong fee reporting; pool with malicious fee_rate could cause unexpected behavior.
- **Fix:** Validate `fee_rate <= 10000` at pool state fetch time. Reject pools with invalid fee rates.

### BL-M4: `from_big` Returns `Some(0)` for Empty BigUint — Masks Zero-Output Bug
- **File:** `crates/intent-solver/src/lib.rs`
- **Code:**
  ```rust
  fn from_big(v: &BigUint) -> Option<u128> {
      let bytes = v.to_bytes_le();
      if bytes.len() > 16 { return None; }
      let mut arr = [0u8; 16];
      arr[..bytes.len()].copy_from_slice(&bytes);
      Some(u128::from_le_bytes(arr))
  }
  ```
- **Bug:** `BigUint::from(0u32).to_bytes_le()` returns `[0]` (length 1), so `from_big` returns `Some(0)`. This means `calculate_swap_exact_input` can return `Ok(0)` for swaps that produce zero output. The caller checks `amount_out < intent.min_amount_out`, but if `min_amount_out` were somehow 0 (e.g., from corrupted DB data), the swap would succeed with zero output — user loses all input.
- **Impact:** Medium — requires either corrupted data or bypassed validation. Defense-in-depth issue.
- **Fix:** Add explicit `if result == BigUint::from(0u32) { return Err(AmmError::ZeroInput); }` in all calculate functions.

### BL-M5: `check_add_liquidity` Minimum Initial Liquidity Check Is Too Low
- **File:** `crates/types/src/intent/checker.rs`
- **Code:**
  ```rust
  const MIN_INITIAL_LIQUIDITY: u128 = 1000;
  if pair.total_lp_supply == 0 {
      if intent.amount_in < MIN_INITIAL_LIQUIDITY || intent.min_amount_out < MIN_INITIAL_LIQUIDITY {
          return Err(CheckError::InvalidAddLiquidityIntent);
      }
  }
  ```
- **Bug:** 1000 smallest units is extremely low for initial liquidity. For a token with 8 decimals, 1000 units = 0.00001 tokens. An attacker can:
  1. Create a pool with 1000 token_x and 1 token_y (ratio 1000:1)
  2. The LP minted = sqrt(1000 * 1) = 31 LP tokens
  3. A subsequent honest user adding proportional liquidity (e.g., 1000:1) would get LP proportional to the manipulated ratio
  4. The attacker can front-run the honest user by donating tokens to the pool (inflating reserves without getting LP), then add liquidity at the inflated ratio — classic "first depositor" attack.
  
  Actually, with `MIN_INITIAL_LIQUIDITY = 1000` for BOTH amounts, the check prevents extreme ratios. But 1000:1000 initial deposit is still tiny and manipulable.
- **Impact:** Pool initialization with dust amounts enables price manipulation.
- **Fix:** Increase `MIN_INITIAL_LIQUIDITY` to at least `10^6` or require minimum USD-equivalent value.

### BL-M6: Transaction Builder Doesn't Validate Total CKB Capacity Balance
- **File:** `crates/intent-solver/src/tx.rs`, `build_batch_transaction()`
- **Bug:** The function creates output cells with hardcoded `capacity: 14200000000` (142 CKB) for each UDT output. It does NOT verify that:
  1. The total output capacity ≤ total input capacity (CKB conservation)
  2. Each intent cell's capacity is sufficient to cover the output cell(s)
  3. The fee cell has enough capacity for all outputs
  
  If there are 50 swaps in a batch, that's 50 × 142 CKB = 7100 CKB just for swap outputs, plus the pool cell, plus refund cells. If the fee cell doesn't have enough capacity, the transaction will be rejected by CKB.
- **Impact:** Batch transactions may fail due to insufficient capacity, leaving intents stuck in Processing.
- **Fix:** Calculate total required capacity before building outputs. Verify `sum(input_capacity) >= sum(output_capacity) + tx_fee`. Error early if insufficient.

---

## LOW — Correctness Issues

### BL-L1: `integer_sqrt` Function Defined But Never Used
- **File:** `crates/intent-solver/src/lib.rs`, bottom of file
- **Code:**
  ```rust
  fn integer_sqrt(n: u128) -> u128 { ... }
  ```
- **Bug:** The function exists but the code uses `BigUint::sqrt()` instead (via `product.sqrt()` in `calculate_add_liquidity`). Dead code.
- **Impact:** None — but indicates code hygiene issue and possible confusion about which sqrt is used.
- **Fix:** Remove the unused function.

### BL-L2: `ClaimTaskRequest` Still Accepts `account_id` in Request Body
- **File:** `crates/api-common/src/intents.rs`
- **Code:**
  ```rust
  pub struct ClaimTaskRequest {
      pub account_id: u64,  // Still present in request body
      pub task_id: u64,
  }
  ```
  While `tasks/claim.rs` correctly ignores it and uses JWT claims.
- **Bug:** The request schema still accepts `account_id`, which is confusing for API consumers. The field is ignored but documented in OpenAPI.
- **Impact:** API confusion; no security impact since it's ignored.
- **Fix:** Remove `account_id` from `ClaimTaskRequest`.

### BL-L3: Pool Hash Used As Filter Is Not Length-Validated
- **File:** `crates/api/src/external/get_utxo_global.rs`
- **Code:**
  ```rust
  let pool_type_hash_filter = query.pool_type_hash.clone().unwrap_or_default();
  let _pool = pools::Entity::find()
      .filter(pools::Column::TypeHash.eq(pool_type_hash_filter.as_bytes().to_vec()))
  ```
- **Bug:** The pool_type_hash query parameter is used as raw string bytes (`.as_bytes()`), not as a hex-decoded 32-byte hash. A query like `?poolTypeHash=abc` would search for `[0x61, 0x62, 0x63]` instead of hex-decoded bytes. This will never match any pool, returning empty results.
- **Impact:** API always returns empty for UTXO Global integration. Functional bug.
- **Fix:** Use `hex::decode()` on the query parameter and validate it's 32 bytes.

### BL-L4: Test Coverage Gaps in AMM Edge Cases
- **File:** `crates/intent-solver/src/lib.rs`, `#[cfg(test)]` module
- **Missing tests:**
  - No test for `amount_out == 0` (1-wei swap)
  - No test for fee_rate = 0 (zero-fee pool)
  - No test for fee_rate = 10000 (100% fee)
  - No test for remove_liquidity where `lp_amount == total_lp` (complete drain)
  - No test for add_liquidity with asymmetric amounts (one side larger than proportional)
  - No test for `calculate_swap_exact_output` where `required_in > amount_in`
  - No property-based testing for k-invariant preservation
- **Impact:** Untested edge cases may harbor bugs.
- **Fix:** Add comprehensive edge-case and property-based tests.

---

## Architectural Observations (Not Bugs — Design Concerns)

### A-1: Two Parallel Transaction Building Paths
Both `crates/intent-solver/src/tx.rs` and `crates/utils/src/liquidity_pairs/batch_tx.rs` build CKB transactions. `batch_tx.rs` also has its own `calculate_swap()` that duplicates the solver's math (though now unified via BigUint). This dual-path architecture is fragile — any change to one must be mirrored in the other.

### A-2: On-Chain Pool State Not Validated Against DB
`process_pool_batch()` fetches on-chain pool state but doesn't compare it against the DB-cached state. A stale DB could cause price display inconsistencies (UI shows one price, execution uses another).

### A-3: No K-Invariant Verification Post-Swap
After processing a swap batch, the solver doesn't verify that `new_reserve_x * new_reserve_y >= old_reserve_x * old_reserve_y`. This invariant check would catch any AMM math bugs at the batch level.

---

## Summary Table

| ID | Severity | Category | Issue | Fund Loss? |
|----|----------|----------|-------|------------|
| BL-C1 | CRITICAL | Type Script | Swap output type_script args are wrong (type_hash used as args) | **YES** — users receive invalid tokens |
| BL-C2 | CRITICAL | Type Script | LP token and burn output type_script args equally wrong | **YES** — all liquidity operations affected |
| BL-C3 | CRITICAL | Refund | Swap-exact-output excess input not refunded to user | **YES** — excess tokens absorbed by pool |
| BL-H1 | HIGH | Rounding | Zero-output swaps not rejected at solver level (defense-in-depth) | Potential, requires bypass |
| BL-H2 | HIGH | Rounding | Add-liquidity actual_y rounding + no refund for excess tokens | **YES** — proportional excess lost |
| BL-H3 | HIGH | DOS | Single bad intent fails entire batch; intents stuck in Processing | Indirect — funds locked |
| BL-H4 | HIGH | Duplicate | Two divergent remove-liquidity implementations | May block large withdrawals |
| BL-H5 | HIGH | Liveness | Under high load, older intents could be starved | Indirect — fund locking |
| BL-M1 | MEDIUM | Timing | constant_time_eq leaks key length | No |
| BL-M2 | MEDIUM | Atomicity | Crash between Processing and Refunded marks leaves intents stuck | Indirect — fund locking |
| BL-M3 | MEDIUM | Validation | fee_rate not validated ≤ 10000; wrong fee_amount on overflow | Potential |
| BL-M4 | MEDIUM | Rounding | from_big returns Some(0) — zero output masked | Potential, requires bypass |
| BL-M5 | MEDIUM | Economic | MIN_INITIAL_LIQUIDITY too low — dust pool manipulation | Potential |
| BL-M6 | MEDIUM | CKB | No CKB capacity balance check in tx builder | Indirect — batch failure |
| BL-L1 | LOW | Dead code | integer_sqrt defined but unused | No |
| BL-L2 | LOW | API | ClaimTaskRequest still accepts unused account_id field | No |
| BL-L3 | LOW | API | get_utxo_global uses string bytes instead of hex-decoded hash | Functional bug |
| BL-L4 | LOW | Testing | Insufficient AMM edge-case test coverage | No |

---

## Priority Recommendations

### Immediate (blocks any real fund handling):
1. **BL-C1 + BL-C2:** Fix ALL output type_script args — this is the #1 blocker. Without correct type scripts, no transaction will work on CKB mainnet.
2. **BL-C3:** Implement excess-input refund cell for swap-exact-output.

### Before any testnet deployment:
3. **BL-H3:** Handle batch-level errors gracefully — rollback intent statuses on failure.
4. **BL-H4:** Remove duplicate remove-liquidity code path.
5. **BL-M6:** Add CKB capacity balance verification.
6. **BL-M3:** Validate fee_rate bounds.

### Before mainnet:
7. **BL-H1 + BL-M4:** Reject zero-output swaps at solver level.
8. **BL-H2:** Handle add-liquidity excess token refunds.
9. **BL-M2:** Wrap status updates in DB transaction.
10. **BL-M5:** Increase minimum initial liquidity.
11. **A-3:** Add k-invariant post-verification.
12. **BL-L4:** Comprehensive AMM testing with property-based tests.
