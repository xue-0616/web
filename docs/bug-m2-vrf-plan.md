# BUG-M2 — On-chain VRF Upgrade Plan

**Status:** DESIGN ONLY (not yet implemented)
**Severity:** HIGH
**Scope:** `mystery-bomb-box-backend` (Solana bomb-box lottery draw)
**Author:** security-audit pass, commits `16f532e..4741fad`
**Last updated:** 2026-04-20

---

## 1. Problem statement

The bomb-box lottery assigns one of two outcomes to every `GrabMysteryBoxEntity` at *distribute time*:

- `isBomb = true` → participant forfeits their stake (multiplied 1.8× as a penalty).
- `isBomb = false` → participant receives a `lotteryDrawAmount` share of the pot.

Today the assignment is performed **entirely off-chain** by the submitter service (`mystery-bomb-box-backend`). The submitter:

1. Watches for a box to hit `GRAB_ENDED`.
2. Chooses which grabs are bombs using **backend-local randomness** (current source is not in this repo — either `Math.random`, `crypto.randomBytes`, or a deterministic function of block time / slot — see §2).
3. Signs and submits a Solana `DistributeMysteryBox` tx containing the final `DistributeItem[]` list.
4. Writes the result back to MySQL (`isBomb`, `lotteryDrawAmount`).

### Why this is BUG-M2 (HIGH)

Any entity that can influence the submitter's RNG input *before* the distribute tx is signed can steer the outcome in their favour:

| Attack surface | Who can exploit it | Impact |
|---|---|---|
| **A. Submitter operator.** The party running the backend has unilateral choice over who bombs. | Insider | Rug-pull of entire pot; collusive wins |
| **B. Block-ordering.** If the RNG seed is derived from `recentBlockhash` / `slot` / `block_time`, Solana validators (or MEV searchers with validator coordination) can nudge which slot the submitter reads. | Validator / MEV searcher | Bias outcome of high-value boxes |
| **C. Request-ordering.** If the RNG seed incorporates the order grabs land in the DB (`grabMysteryBoxs.id`), an attacker that can time their grab to be the N-th entry can favour themselves. | Any participant with low-latency RPC | Small but systematic edge |
| **D. Reproducible PRNG.** If the backend uses `Math.random()` seeded from wall-clock, an attacker with timing side-channels can reproduce the state. | Any participant (hard) | Full prediction of outcomes |

Surface **A** is the killer: there is *no cryptographic proof* that the submitter rolled an honest draw, so the system is trust-dependent on the operator.

### Why this wasn't fixed in the backend-only audit pass

Fixing B/C/D is possible in the backend (hash of a commit-reveal pair, add a pre-declared server seed, etc.) but fixing **A** requires the randomness to come from *outside* the submitter — i.e. from the Solana chain itself or from an external verifiable RNG. That is a **protocol-level change**: the on-chain program must consume a VRF proof and the submitter must wait for it. Cannot be done with just backend edits.

---

## 2. Current randomness source — assumed

We could not locate the RNG call in the committed tree (the OSS snapshot likely strips it, or the function name differs from our greps). For planning purposes we assume the worst plausible case:

```
isBomb[i] = prng_seeded_by(block_time ⊕ box_id ⊕ grab_id)
```

This covers every attack vector A-D. The upgrade plan below makes the plan *independent of what the current RNG is*, because we replace the entire assignment step with an on-chain VRF consumer.

> **Action before implementation:** grep the private source tree for the real RNG call and add it verbatim to this doc so the migration test suite can assert the old path is fully removed.

---

## 3. Option comparison

Two production-grade VRF options on Solana:

### 3.1 Switchboard On-Demand VRF (`switchboard-v3`)

- **Docs:** <https://docs.switchboard.xyz/solana/vrf>
- **Model:** Request-response. Backend submits `RequestRandomness`, Switchboard oracle network responds via callback after 1-2 slots, paying ~0.002 SOL per request.
- **Proof:** VRF output signed by the oracle network; verifiable on-chain.
- **Latency:** ~400-800 ms mainnet.
- **Dependencies:** Switchboard aggregator account + permission account; no Anchor required but SDKs exist for Rust (`switchboard-on-demand`) and TypeScript (`@switchboard-xyz/on-demand`).
- **Pros:** production-proven (Drift, Meteora, Sanctum all use it), supports callback CPI so randomness lands atomically with distribute, good monitoring.
- **Cons:** new external dependency (ecosystem); per-request SOL cost; additional accounts to manage.

### 3.2 ORAO VRF (`orao-solana-vrf`)

- **Docs:** <https://orao.network/vrf-solana>
- **Model:** Same request-response; oracle writes the proof to a PDA; on-chain program verifies via ed25519 signature.
- **Proof:** ed25519 signature over `seed || epoch`.
- **Latency:** ~500-1500 ms mainnet.
- **Dependencies:** Anchor program (it's Anchor-first); SDKs in Rust and TypeScript.
- **Pros:** simpler to integrate in Anchor; low fee (~0.002 SOL); smaller attack surface (single signer, committee rotation).
- **Cons:** single-signer trust model (committee of 3-5 vs Switchboard's larger aggregator quorum); less adoption → ecosystem risk.

### Recommendation

**Switchboard On-Demand VRF** for mainnet. Reasoning:

1. Bomb-fun is a gambling product — the marginal cost of oracle fees is trivial vs. the reputational cost of a rigged draw.
2. Switchboard's quorum is larger and its uptime record is longer.
3. Callback CPI support lets us make "request VRF → on-chain commit bombs → distribute SOL" a single atomic flow, eliminating the surface-B block-ordering class of attacks entirely.

---

## 4. Target architecture

```
┌──────────────────┐       ┌──────────────────────┐       ┌────────────────┐
│ backend          │  1    │ on-chain bomb-box    │  3    │ Switchboard    │
│ (submitter)      │ ────▶ │ program (new)        │ ────▶ │ On-Demand VRF  │
│                  │       │                      │       │                │
│ - picks box      │       │ - PDA: BoxState      │       │                │
│ - calls          │       │ - stores sealed grabs│◀─── 4 │ callback CPI   │
│   RequestDraw    │       │ - verifies VRF proof │       │ with proof     │
│                  │       │ - atomically:        │       │                │
│ 6. observes      │◀── 5  │   * assigns isBomb   │       │                │
│ BoxState.drawn   │       │   * emits event      │       │                │
│ 7. settles DB    │       │ - distributes SOL    │       │                │
│                  │       │   in same ix         │       │                │
└──────────────────┘       └──────────────────────┘       └────────────────┘
```

### Key invariants the new program enforces

- **I1.** Exactly one VRF draw per box. Replay is blocked by a `drawn: bool` flag on `BoxState`.
- **I2.** `bombCount` is fixed at box creation and stored on-chain. The VRF output cannot change the number of bombs, only *which* grab gets each bomb.
- **I3.** Distribute amounts are a pure function of (`pot`, `bombCount`, `isBomb[i]`). The on-chain program computes them; the backend is not trusted to supply amounts.
- **I4.** The grab ordering fed to the VRF is the on-chain order grabs were registered (PDA seq counter), not the backend's DB ordering. Closes surface **C**.
- **I5.** Grabs registered after `grab_end_time` (on-chain clock) are rejected. Closes the late-grab race.

### Bomb-selection algorithm (pure, verifiable)

```rust
// seed: 32-byte VRF output from Switchboard
// grabs: Vec<Pubkey> in registration order
// bomb_count: u8
// returns: BitSet of length grabs.len(), exactly bomb_count bits set
fn select_bombs(seed: [u8; 32], grabs: &[Pubkey], bomb_count: u8) -> BitSet {
    // Fisher-Yates shuffle of indices [0..grabs.len()) keyed by seed,
    // then take the first bomb_count indices.
    // Deterministic + uniformly distributed + independently re-checkable.
    let mut rng = ChaCha20Rng::from_seed(seed);
    let mut idx: Vec<usize> = (0..grabs.len()).collect();
    for i in (1..idx.len()).rev() {
        let j = rng.gen_range(0..=i);
        idx.swap(i, j);
    }
    let mut bombs = BitSet::with_capacity(grabs.len());
    for &i in idx.iter().take(bomb_count as usize) {
        bombs.set(i);
    }
    bombs
}
```

This is ~15 lines of Rust and is the entire "trust me" surface reduced to a publicly auditable function keyed by a VRF proof.

---

## 5. Contract changes (Rust / Anchor)

### 5.1 New program: `bomb_box_program`

Estimated size: **~400 LoC Rust** (not counting tests / IDL).

Accounts:

| Account | Seeds | Purpose |
|---|---|---|
| `BoxState` | `[b"box", box_id.to_le_bytes()]` | Per-box on-chain state: creator, pot, bomb_count, grab_count, drawn, vrf_request |
| `GrabEntry` | `[b"grab", box_id, grab_seq.to_le_bytes()]` | Per-grab PDA: participant pubkey, seq, registered_slot |
| `VrfRequest` | `[b"vrf", box_id]` | Handle for Switchboard callback |

Instructions:

1. `create_box(pot, bomb_count, grab_end_slot)` — initialises `BoxState`.
2. `register_grab()` — one grab per wallet per box; increments `grab_count`; creates `GrabEntry`. Rejects after `grab_end_slot`.
3. `request_draw()` — only callable after `grab_end_slot`; invokes Switchboard `request_randomness`; stores handle in `VrfRequest`; sets `BoxState.draw_pending = true`.
4. `consume_vrf(proof)` — Switchboard callback CPI; verifies proof; runs `select_bombs`; sets `isBomb` bits on each `GrabEntry`; sets `BoxState.drawn = true`; emits `BombsAssigned` event.
5. `claim(grab_seq)` — participant pulls their payout using `BoxState.drawn == true` + their `GrabEntry.is_bomb`.

### 5.2 Program size / compute budget

- `select_bombs` with `grab_count ≤ 200`: ~80 k CU, well under the 200 k default.
- `consume_vrf` with Switchboard verification: ~50 k CU.
- Total per-draw CU: ~130 k; fits in one ix without CU-limit bump.

---

## 6. Backend changes (TypeScript)

Impact on `mystery-bomb-box-backend`:

| Module | Change | LoC |
|---|---|---|
| `modules/transaction/transaction.service.ts` | Replace off-chain `isBomb` assignment with `request_draw` call; wait for `BoxState.drawn == true`; write on-chain result into MySQL (read-only sync). | ~150 |
| `common/utils/transaction.ts` | Build `create_box` / `register_grab` / `request_draw` ixs using the new IDL. Delete `distributeMysteryBox` — payouts are now claimed on-chain by each participant via `claim`. | ~200 deleted, ~150 added |
| `modules/transaction/validators.ts` | Keep the param validators (BUG-M1 fix). | 0 |
| `modules/db/db.service.ts` | `distributeMysteryBox` / `successDistributeMysteryBox` / `failDistributeMysteryBox` collapse into a single `syncOnChainDraw` method that reads `BoxState` + `GrabEntry` and mirrors into MySQL. | ~250 deleted, ~80 added |
| `modules/transaction/distribute-timeout.ts` | Becomes: `decideSyncDrawAction` — observe that MySQL is out of sync with on-chain and reconcile. | ~30 |

Expected net: **~300 LoC fewer** in the backend, because the backend stops being the gamemaster.

---

## 7. Migration plan (phased)

### Phase 0 — Instrument current path (1-2 days)

- Find & document the real RNG call (section 2 assumption must be verified).
- Add a feature flag `USE_ONCHAIN_VRF` that defaults to false.
- Add a read-only "shadow draw" mode that records what the on-chain program *would* have assigned (once it exists) alongside the current backend-assigned `isBomb`, for reconciliation.

### Phase 1 — Deploy on-chain program to devnet (1 week)

- Audit-ready Anchor program (section 5).
- Unit tests (`anchor test`) covering:
  - `select_bombs` uniformity (χ² over 10 000 runs per (n, bomb_count) combo).
  - `register_grab` after `grab_end_slot` rejects.
  - Double-draw is blocked.
  - Switchboard proof tampering rejects.
- Deploy to devnet; run 1 000 synthetic boxes.

### Phase 2 — Shadow mode on mainnet (2 weeks)

- Backend issues `create_box` + `register_grab` + `request_draw` on mainnet.
- Backend still settles using old off-chain path to avoid user-facing risk.
- Compare on-chain `isBomb` bits to DB `isBomb` values. **Expect divergence.** Alert if on-chain program crashes or VRF times out.
- Success criterion: 100% of devnet boxes complete the on-chain draw within 3 slots of `request_draw`; zero program aborts on mainnet shadow.

### Phase 3 — Cutover (1 day)

- Flip `USE_ONCHAIN_VRF=true`.
- Backend stops writing `isBomb`; instead reads it from `GrabEntry`.
- Distribute moves from backend-submitted to participant-pulled `claim` ix. (Alternative: submitter continues to pay gas for claim on users' behalf via CPI wrapper, for UX parity — recommended for launch.)

### Phase 4 — Rollback path

- Keep the old code path behind the flag for 30 days.
- If a critical bug is found in the program: flip flag off, pause new `create_box` calls, refund open boxes via admin `emergency_refund` ix (pre-coded, gated by multisig).
- Never delete the old path until on-chain draws have reached ≥ 10 000 boxes with zero incidents.

---

## 8. Testing strategy

### 8.1 Statistical tests (pre-deploy, mandatory)

`select_bombs` must pass:

- χ² test at α = 0.01 for uniform bomb placement, across 10 000 draws at each of `(n, bomb_count) ∈ {(10,1), (50,5), (100,10), (200,20)}`.
- No-correlation test between consecutive draws: Pearson r < 0.02 on the bomb-index streams.
- These live as `#[test] fn bomb_distribution_is_uniform()` in the Anchor program's tests/ dir and **also** as a fuzz target under `proptest` keyed by the VRF seed.

### 8.2 On-chain integration tests

- `register_grab` across 200 accounts, then `request_draw`, verify callback fires and all 200 `GrabEntry.is_bomb` flags match `select_bombs(vrf_seed, [...], bomb_count)`.
- Attempt double-draw → must fail with `DrawAlreadyCompleted`.
- Attempt grab after `grab_end_slot` → must fail with `GrabWindowClosed`.

### 8.3 Backend contract tests

- Mock Switchboard callback and assert `syncOnChainDraw` produces identical `GrabMysteryBoxEntity.isBomb` / `lotteryDrawAmount` values as the on-chain PDA state.
- Regression: keep the existing 31 mystery-box jest tests as-is; none should need to change since all are on the parameter-validation layer, which is unaffected.

### 8.4 Security review

- Third-party audit of the Anchor program **before** Phase 2. Budget: ~$15-25k for a 400-LoC program at a reputable firm (Ottersec, Neodyme, Zellic).
- Publish the audit report alongside the program's verified on-chain build.

---

## 9. Costs (rough)

| Item | Cost |
|---|---|
| Anchor program dev + tests | ~2 engineer-weeks |
| Backend refactor | ~1.5 engineer-weeks |
| Third-party audit | ~$15-25k |
| Switchboard mainnet fee | ~0.002 SOL / draw ≈ $0.30 at SOL=$150 |
| Mainnet deploy + initial SOL for PDA rent | ~2 SOL one-time |
| Ops tooling (monitoring VRF timeouts, program alerts) | ~0.5 engineer-week |
| **Total eng time** | **~4 engineer-weeks** |
| **Total $ cost** | **~$20-30k audit + ongoing oracle fees** |

---

## 10. Alternatives considered and rejected

- **Commit-reveal with a pre-declared server seed.** Fixes B/C/D but not A. Operator can still rig by choosing which seed to publish after seeing grabs. Rejected.
- **Solana's slot hash as randomness source.** Manipulable by validators with 1-slot lookahead. Rejected for a gambling product.
- **Hash chain from multiple participants' signed messages.** Collusion-resistant in theory, but UX-hostile (requires every participant to sign a reveal) and Sybil-vulnerable. Rejected.
- **Chainlink VRF.** No production Solana support at time of writing. Rejected.
- **Do nothing / document the trust assumption.** Legally + reputationally untenable for a public-facing gambling product. Rejected.

---

## 11. Decision needed from ops / product

1. Sign-off on Switchboard vs. ORAO choice (recommendation: Switchboard).
2. Budget approval for third-party audit.
3. UX decision: does the submitter relay `claim` ixs on users' behalf (keeps current UX) or do users `claim` themselves after drawn=true (saves gas for treasury)?
4. Communications plan — announce VRF migration to users; publish audit report on go-live.

---

## 12. Post-migration success metrics

- 0 operator-originated `isBomb` writes in the code path.
- 100% of draws produce a verifiable on-chain VRF proof that can be re-checked by any third party.
- `select_bombs` uniformity continues to pass χ² at α = 0.01 on the first 1 000 mainnet draws.
- Zero rolled-back or disputed draws in the first 30 days.

---

## Appendix A — glossary

- **VRF (Verifiable Random Function):** a cryptographic function that produces an output + proof such that anyone holding a public key can verify the output was generated fairly, but only the holder of the private key could have generated it.
- **PDA (Program-Derived Address):** a Solana account whose address is deterministically derived from the program + seeds; only the program can sign for it.
- **CPI (Cross-Program Invocation):** one Solana program calling another within the same transaction.
- **CU (Compute Unit):** Solana's gas-equivalent. Default 200 k per ix.

## Appendix B — related audit findings addressed

| Bug | Resolved by this plan? |
|---|---|
| BUG-M1 (grab param injection) | Already fixed in backend (commit `16f532e`). |
| BUG-M3 (distribute timeout state machine) | Already fixed in backend (commit `da4fa2d`). With VRF on-chain, timeouts become trivially idempotent (`drawn` flag). |
| BUG-M6 (DB transaction management) | Already fixed (commit `adb7e9c`). With VRF, backend does less DB work, so this surface shrinks. |
| **BUG-M2 (this)** | **Yes — this is the plan.** |
