# `solagram-wallet-oss`

Greenfield rewrite. Replaces `frontend/solagram-wallet-src/` (decompiled minified bundle).

## Stack

Telegram Mini App + React + Vite

## Purpose

Solagram TG-native wallet (Mini App shell + Solana wallet)

## Estimate

~10 person-days.

## Build

```bash
npm install
npm run build       # → dist/
```

## Status

**Yellow / Scaffold** - repo structure + build system + placeholder entry + Phase 7 tracker entry. UI + business logic to be rebuilt from production screenshots (no source reference available).

## How this differs from Phase 5 / 6

- Phase 5: open-source upstream available -> wrap it.
- Phase 6: closed-source UniPass product, but domain is known.
- **Phase 7**: fully unknown product (HueHub / Solagram / Bomb.fun). Requires UX discovery from production bundle screenshots.
