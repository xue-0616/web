# Upstream Source Mapping

This directory holds the **publicly available upstream source code** for projects
where the local repository only contained pre-compiled binaries (`backend-bin/`)
or webpack-decompiled fragments (`frontend/*-src/`).

> The cloned sources are **for reference only** — they may have diverged from the
> deployed binaries in this workspace. Do **not** rebuild and redeploy without
> diffing against the local artefacts first.

## 🔎 HueHub deep-dive findings

Initial sweep reported "HueHub entirely private", but binary analysis revealed
that **HueHub's backend is mostly open-source infrastructure** with a thin
proprietary glue layer:

| HueHub binary | What it actually is |
|---|---|
| `backend-bin/dexauto-data-center/substreams-sink-sql` | **Open-source** StreamingFast binary — see `upstream/substreams-sink-sql/` |
| `backend-bin/dexauto-data-center/tl-solana-dex-trades-extended-*.spkg` | **Open-source** TopLedger substreams package — see `upstream/solana-programs/` |
| `backend-bin/trading-tracker/trading-tracker` | Custom Rust binary built by StreamingFast (`/Users/stepd/…` in BuildInfo) consuming `substreams-solana` — glue code is proprietary, but the framework is `upstream/solana-token-tracker/` |
| `backend-bin/huehub-rgbpp-indexer/rgbpp` | Proprietary Rust (crate `rgbpp_indexer` with modules `indexer::RgbppIndexer`, `watchers::{btc,ckb,indexer}_watcher`) — **no public counterpart**, but depends heavily on `upstream/rgbpp` (utxostack) |

Frontend HueHub apps (`auto-dex-site`, `bomb-fun-site`, `huehub-dex-site`) —
webpack bundles contain only 3rd-party library references
(react / next / ethers / solana-wallet-standard / etc.) and no HueHub-owned repo
URLs. These are **confirmed closed-source**.

---

## ✅ Cloned (17 repos, ~100 MB total, depth=1)

| Local artefact | → | Upstream repo | Notes |
|---|---|---|---|
| `backend-bin/dexauto-data-center/substreams-sink-sql` | → | [`streamingfast/substreams-sink-sql`](https://github.com/streamingfast/substreams-sink-sql) | **Exact same open-source binary** |
| `backend-bin/dexauto-data-center/*.spkg` | → | [`Topledger/solana-programs`](https://github.com/Topledger/solana-programs) | Open-source TopLedger DEX-trades substreams |
| `backend-bin/trading-tracker/` | → | [`streamingfast/solana-token-tracker`](https://github.com/streamingfast/solana-token-tracker) | Framework basis (binary likely fork thereof, built by StreamingFast author `stepd`) |
| `backend-bin/apple-id-public-key/` | → | [`UniPassID/UniPass-OpenID-Auth`](https://github.com/UniPassID/UniPass-OpenID-Auth) | Apple ID + OpenID auth helper (shared with `dkim-and-open-id-monitor`) |
| `backend-bin/asset-migrator/` | → | [`utxostack/utxo-allocator`](https://github.com/utxostack/utxo-allocator) | UTXO allocator — likely upstream (verify) |
| `backend-bin/dkim-and-open-id-monitor/` | → | [`UniPassID/UniPass-OpenID-Auth`](https://github.com/UniPassID/UniPass-OpenID-Auth) | Same monorepo as `apple-id-public-key` |
| `backend-bin/huehub-rgbpp-indexer/` | → | [`utxostack/rgbpp`](https://github.com/utxostack/rgbpp) | RGB++ indexer — HueHub fork is private |
| `backend-bin/paymaster-service/` | → | [`UniPassID/account-abstraction`](https://github.com/UniPassID/account-abstraction) | ERC-4337 stack incl. paymaster |
| `backend-bin/stackup-bundler/` | → | [`UniPassID/stackup-bundler`](https://github.com/UniPassID/stackup-bundler) | Confirmed UniPass fork (the upstream is `stackup-wallet/stackup-bundler`) |
| `backend-bin/unipass-snap-service/` | → | [`UniPassID/UniPass-Snap`](https://github.com/UniPassID/UniPass-Snap) | Snap service inside the monorepo |
| `backend-bin/unipass-wallet-tss/` | → | [`UniPassID/UniPass-Tss-Lib`](https://github.com/UniPassID/UniPass-Tss-Lib) | Threshold-signing library |
| `backend-bin/unipass-wallet-zk-server/` | → | [`UniPassID/UniPass-email-circuits`](https://github.com/UniPassID/UniPass-email-circuits) | zk-email circuits (server side) |
| `frontend/payment-specifications-src/` | → | [`UniPassID/UniPass-Wallet-Docs`](https://github.com/UniPassID/UniPass-Wallet-Docs) | Docs monorepo includes payment specs |
| `frontend/payment-swagger-src/` | → | [`UniPassID/UniPass-Wallet-Docs`](https://github.com/UniPassID/UniPass-Wallet-Docs) | Same docs monorepo |
| `frontend/solana-wallet-mini-app-demo-src/` | → | [`UniPassID/smart-account-vite-demo`](https://github.com/UniPassID/smart-account-vite-demo) | Vite demo, likely template basis |
| `frontend/unipass-app-h5-src/` | → | [`UniPassID/unipass-frontend-test`](https://github.com/UniPassID/unipass-frontend-test) | H5 frontend test scaffold |
| `frontend/unipass-snap-frontend-src/` | → | [`UniPassID/UniPass-Snap`](https://github.com/UniPassID/UniPass-Snap) | Snap frontend in same monorepo |
| `frontend/unipass-snap-react-src/` | → | [`UniPassID/UniPass-Wallet-Snap`](https://github.com/UniPassID/UniPass-Wallet-Snap) | React Snap wallet |
| `frontend/unipass-wallet-js-src/` | → | [`UniPassID/UniPass-Wallet-JS`](https://github.com/UniPassID/UniPass-Wallet-JS) | (also already at `frontend/unipass-wallet-js-github/`) |
| `frontend/utxo-swap-site-src/` | → | [`utxostack/utxo-stack-sdk`](https://github.com/utxostack/utxo-stack-sdk) | UTXO Stack SDK — site likely built on this |

## ❌ Not Found (15 — no public upstream identified)

| Local artefact | Org searched | Likely status |
|---|---|---|
| `backend-bin/denver-airdrop-rs/` | UniPassID, utxostack, RGBPlusPlus | Internal/private |
| `backend-bin/dexauto-data-center/` | UniPassID, utxostack, HueHubLabs (org missing) | Internal — HueHub appears entirely private |
| `backend-bin/trading-tracker/` | as above | Internal |
| `frontend/auto-dex-site-src/` | as above | Internal HueHub frontend |
| `frontend/blinks-miniapp-src/` | UniPassID | Likely Solana Blinks demo, no public twin |
| `frontend/bomb-fun-site-src/` | — | Internal product |
| `frontend/hongkong-wanxiang-festival-src/` | UniPassID | Event-specific, likely private |
| `frontend/huehub-dex-site-src/` | HueHub | Private |
| `frontend/solagram-wallet-src/` | UniPassID | Internal product (Solana + Telegram) |
| `frontend/solagram-web-site-src/` | as above | Internal |
| `frontend/unipass-auth0-verify-code-src/` | UniPassID | Likely small internal page |
| `frontend/unipass-cms-frontend-src/` | UniPassID | Internal CMS UI |
| `frontend/unipass-payment-web-src/` | UniPassID | Internal payment UI |
| `frontend/unipass-wallet-frontend-src/` | UniPassID | Internal main wallet UI |
| `frontend/unipass-wallet-official-website-src/` | UniPassID | Marketing site |

> **HueHubLabs / HueHub orgs are not present on public GitHub** — all HueHub-branded
> projects (dexauto-data-center, trading-tracker, huehub-rgbpp-indexer's HueHub fork,
> auto-dex-site, bomb-fun-site, huehub-dex-site) appear to be closed-source.

## How to use

- **For reference / understanding**: browse the cloned source under
  `upstream/<repo-name>/` to study how the corresponding deployed binary or
  bundle was originally implemented.
- **For diffing / patch development**: `diff -r upstream/<repo>/ backend-bin/<x>/_scaffold/`
  to estimate how far the deployed binary has drifted from the public source.
- **For rebuilding**: each upstream repo has its own README and build instructions.
  Verify the version/branch matches the deployed binary before attempting a rebuild.

## Re-running the clone

```bash
bash upstream/_clone.sh        # idempotent — skips already-cloned dirs
bash upstream/_probe2.sh       # re-verify URL availability
```

Generated automatically. Do not commit the cloned repos themselves
(see root `.gitignore`).
