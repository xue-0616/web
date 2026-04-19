# Rust ELF Skeleton Reconstruction

Automatically generated **compilable Rust skeletons** for the three proprietary
Rust binaries that have no public upstream. Every `todo!()` hides the original
logic — the skeletons expose module structure and public API surface only.

> Tool: `upstream/_reconstruct.py`
> Rerun: `python3 upstream/_reconstruct.py`

---

## 👉 Human-readable guides (start here)

Before diving into symbols and pseudo-C, read the per-binary narrative
guides — they explain **what each binary actually does** in plain language
with reconstructed API sketches:

- `@/home/kai/桌面/55182/链上自动化交易源码/upstream/_reconstructed/denver-airdrop-rs/HUMAN_GUIDE.md`
  — EVM NFT airdrop monitor (ethers-rs based)
- `@/home/kai/桌面/55182/链上自动化交易源码/upstream/_reconstructed/huehub-rgbpp-indexer/HUMAN_GUIDE.md`
  — RGB++ asset indexer (Bitcoin + CKB watchers + redb + axum)
- `@/home/kai/桌面/55182/链上自动化交易源码/upstream/_reconstructed/trading-tracker/HUMAN_GUIDE.md`
  — Solana DEX price tracker (StreamingFast Substreams + jsonrpsee)

Each guide has an **evidence-strength table** at the bottom showing which
claims are certainty (Ghidra-confirmed) vs. typical-pattern inference.

## Statistics

| Binary | Crates | `.rs` files | LOC | Stubs | Deps | **Ghidra pseudo-C** | **calls:** | **trait-hint** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `denver-airdrop-rs` | 2 | 5 | 519 | 13 | 82 | 8 (61.5%) | 7 | 7 |
| `huehub-rgbpp-indexer` | 3 | 8 | 5 328 | 144 | 186 | 104 (72.2%) | 103 | 21 |
| `trading-tracker` | 2 | 8 | 2 814 | 57 | 99 | 52 (91.2%) | 50 | 9 |
| **Total** | 7 | 21 | **8 661** | **214** | 367 | **164 (76.6%)** | **160** | **37** |

All three `cargo check` cleanly **with the Ghidra comments embedded** (Rust
supports nested block comments, so `/* /* */ */` blocks are valid).

The unmatched 50 stubs are almost exclusively `pub struct X;` declarations
whose types never had callable methods compiled in — there is nothing for
Ghidra to decompile for a pure data-type symbol.

## Methodology

1. **Symbol dump** — `nm <elf> | rustfilt` → demangled Rust symbols.
2. **Noise filter** — drop `core::ptr::drop_in_place<…>` helpers, `{{closure}}`
   closure markers, `CALLSITE`/`META` tracing instruments, and standard trait
   methods (`serialize`, `fmt`, `poll`, `from`, …).
3. **Candidate extraction** — for each remaining symbol, scan both the
   generics-stripped form and the original so that types inside `<impl Trait for MyTy>`
   brackets still contribute. Keep candidates whose top segment is in the
   configured "proprietary crates" list.
4. **Path disambiguation** — the longest candidate path wins for the call-site;
   additional CamelCase candidates become distinct struct stubs so that both
   the type and its impl method survive.
5. **Tree emit** — group items by `(crate, module_path)`; emit `pub mod`
   hierarchy, renaming CamelCase path segments to `impl_<name>` to avoid
   struct/mod collisions.
6. **Cargo manifest** — extract every `<crate>-<version>/` substring from
   embedded `.cargo/registry/src/...` paths and list them as **commented**
   dependencies (versions preserved, but the skeleton compiles without them).

## Layout

```
upstream/_reconstructed/
├── denver-airdrop-rs/
│   ├── Cargo.toml                      # [workspace]
│   └── denver-airdrop-rs/              # primary (bin) crate
│       ├── Cargo.toml                  # [[bin]] + 82 commented deps
│       └── src/
│           ├── main.rs                 # entry + pub mod decls
│           ├── airdrop.rs              # AirDrop, PendingTx, AriDropInfo
│           ├── config.rs               # Config
│           ├── contracts.rs            # ethers-generated ABIs + new()
│           └── denver_monitor.rs       # DenverMonitor run loop
│
├── huehub-rgbpp-indexer/
│   ├── Cargo.toml
│   ├── rgbpp-indexer/                  # primary (bin) crate
│   │   └── src/{main, chain, indexer, watchers, tables}.rs
│   └── rgbpp-daos/                     # lib crate
│       └── src/{lib, database, tables}.rs
│
└── trading-tracker/
    ├── Cargo.toml
    └── trading-tracker/                # primary (bin) crate
        └── src/{main, substreams, store, rpc, config, metrics}.rs
```

## Fidelity — what you DO and DON'T get

| Aspect | Reconstructed | Missing |
|---|:---:|:---:|
| Module tree | ✅ 100% from symbol paths | — |
| Function/type names | ✅ Demangled | — |
| Public struct/enum layout | ✅ Names only | ❌ Field names & types |
| Function signatures | ❌ Always `fn() { todo!() }` | ❌ Args & return types |
| Trait impls | ❌ Flattened into free items | ❌ Trait linkage |
| Function bodies | ❌ `todo!()` | ❌ Logic |
| Generic parameters | ❌ Erased | ❌ Original `<T>` bounds |
| Macros | ❌ Expanded away | ❌ Original macro calls |
| `Cargo.toml` deps | ⚠️ Commented-out list | ⚠️ Features unknown |

**Bottom line**: the skeleton is useful for **reading** (understanding what
the binary does at a structural level) and for **seeding a rewrite**, but it
is *not* a source you can build-and-deploy. The real logic lives only in the
ELF and can only be recovered by:
  1. Going through Ghidra/IDA per function, or
  2. Obtaining the original source from the vendor.

## When to use this

- ✅ Auditing: "does the binary call into unexpected external crates?"
- ✅ Porting: "what public API does `trading-tracker` expose that I need to
  re-implement?"
- ✅ Binary diffing: `cargo build --release` on a re-implementation and compare
  symbol counts against the original ELF.
- ❌ Running: the skeleton compiles but does nothing.

## Ghidra pseudo-C injection

Pseudo-C from Ghidra is injected as a `/* ghidra: 0x<addr> sig=... ... */`
block comment placed **between the `/// RE: …` line and the stub item**.

### Pipeline

```
backend-bin/<bin>
     │  nm + rustfilt
     ▼
_reconstruct.py  ───►  upstream/_reconstructed/<bin>/...src/*.rs  (skeleton)
     │
     │  Ghidra headless analyzeHeadless
     │  + _ghidra_export.py  (exports every decompiled function → JSON)
     ▼
/tmp/ghidra_work/out/<bin>.json
     │
     │  _ghidra_inject.py (canonical-name matching)
     ▼
upstream/_reconstructed/<bin>/...src/*.rs  (skeleton + /* ghidra: … */ comments)
```

### Rerun end-to-end

```bash
# 1. Skeleton (fast).
python3 upstream/_reconstruct.py

# 2. Ghidra decompile (slow: ~10-20 min per ELF on 4 cores).
#    Paths must be ASCII because Jython 2.7 can't handle Unicode paths.
mkdir -p /tmp/ghidra_work/{bin,scripts,proj,out}
cp upstream/_ghidra_export.py /tmp/ghidra_work/scripts/
cp backend-bin/denver-airdrop-rs/denver-airdrop-rs  /tmp/ghidra_work/bin/
cp backend-bin/huehub-rgbpp-indexer/rgbpp           /tmp/ghidra_work/bin/
cp backend-bin/trading-tracker/trading-tracker      /tmp/ghidra_work/bin/

for b in denver-airdrop-rs rgbpp trading-tracker; do
  /usr/share/ghidra/support/analyzeHeadless \
      /tmp/ghidra_work/proj "$b" \
      -import /tmp/ghidra_work/bin/"$b" \
      -postScript _ghidra_export.py /tmp/ghidra_work/out/"$b".json \
      -scriptPath /tmp/ghidra_work/scripts \
      -deleteProject
done

# 3. Inject the raw Ghidra pseudo-C blocks.
for pair in "denver-airdrop-rs:denver" "huehub-rgbpp-indexer:rgbpp" "trading-tracker:trading"; do
  skel="${pair%%:*}"; json="${pair##*:}"
  python3 upstream/_ghidra_inject.py \
      --skeleton "upstream/_reconstructed/$skel" \
      --ghidra-json "/tmp/ghidra_work/out/$json.json"
done

# 4. Enrich with calls/strings/trait-hint summaries.
for pair in "denver-airdrop-rs:denver" "huehub-rgbpp-indexer:rgbpp" "trading-tracker:trading"; do
  skel="${pair%%:*}"; json="${pair##*:}"
  python3 upstream/_ghidra_enrich.py \
      --skeleton "upstream/_reconstructed/$skel" \
      --ghidra-json "/tmp/ghidra_work/out/$json.json"
done

# 5. Smoke-test.
for d in upstream/_reconstructed/*/; do (cd "$d" && cargo check); done
```

Both `_ghidra_inject.py` passes are idempotent — they skip stubs that
already have a `/* ghidra: … */` block immediately below the `/// RE:` line.

### Third pass: structured enrichment (`_ghidra_enrich.py`)

After Ghidra pseudo-C is injected, a third pass distills **higher-level
signal** from that pseudo-C into concise one-liner comments placed right
above the stub:

```rust
/// RE: rgbpp_indexer::indexer::RgbppIndexer::balances
// enriched: ---
// calls:
//   - rgbpp_daos::types::script_key::ScriptKey::from_str_and_validate_network
//   - rgbpp_daos::database::RgbppDatabase::begin_read
//   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::connect
//   - rgbpp_daos::tables::rgbpp_balances::RgbppBalancesReadable::balances
// enriched: ---
/* ghidra: 0x0036fc70  sig=... */
pub fn balances() { todo!() }
```

Three kinds of signal are extracted:

1. **`calls:`** — every `<crate>::<path>::<fn>(` pattern found in the
   pseudo-C, filtered to dep crates listed in `INTERESTING_PREFIXES`
   (`tokio`, `reqwest`, `serde*`, `ethers*`, `ckb_*`, `sqlx`, `sea_orm`,
   `solana_*`, …). This instantly reveals *what the function does*.
2. **`strings:`** — best-effort recovery of literal string constants from
   Ghidra's `PTR_s_<slug>_<hex>` symbols.
3. **`trait-hint:`** — when the stub's terminal name matches a well-known
   trait method (`serialize`, `deserialize`, `decode_log`, `fmt`, `new`,
   `build`, `poll`, `from`, …), the ideal Rust signature is inserted for
   reference.

Emission guarantees:

- Comments are bounded by `// enriched: ---` markers so the pass is
  idempotent.
- All tokens are length-capped and newline-stripped — `//` comments can
  never bleed onto code lines.
- The block is placed **between** the `/// RE:` line and the `/* ghidra: */`
  block so both coexist.

### Name-matching strategy

Rust mangles → `rustfilt` demangles into `<impl T for X>::m`, while
Ghidra's demangler emits `_<impl_T_for_X>::m` (underscores instead of
spaces, stripped `impl` keyword, etc.). `_ghidra_inject.py:canonical()`
collapses both forms to a single key before matching, then falls back to
suffix matching on the last two path segments when the trait-impl
normalization doesn't converge.

## Rerun skeleton only

```bash
python3 upstream/_reconstruct.py                # all three
```

The generator is deterministic — every run overwrites the previous
skeleton but PRESERVES the Ghidra comments injected by `_ghidra_inject.py`
(because it re-runs first then the injector adds them back).
