# Phase 7 design tokens

Shared across the 6 HueHub / Solagram / Bomb.fun / Blinks frontends.

**Why not reuse Phase 6 tokens?** Phase 6 is UniPass (violet, minimal,
productivity). Phase 7 is consumer Solana products (dark-first, higher
contrast, product-per-accent). They must stay visually distinct.

## Token set

Each project ships an identical `src/design/tokens.css` + `tokens.ts`
(diff means a missed sync — fail CI later). The only allowed per-project
override is `--accent` via a **tokens.brand.css** file imported *after*
tokens.css:

| Project | Accent | Rationale |
|---|---|---|
| `auto-dex-site-oss` | `#10b981` emerald | Trading/profit signal |
| `huehub-dex-site-oss` | `#3b82f6` blue | Swap clarity |
| `bomb-fun-site-oss` | `#f43f5e` rose | Degen energy |
| `solagram-wallet-oss` | `#d946ef` fuchsia | Solagram brand |
| `solagram-web-site-oss` | `#d946ef` fuchsia | Solagram brand |
| `blinks-miniapp-oss` | `#9945ff` Solana purple | Solana native |

## TOKENS_VERSION

Bump on any palette change. Start at `1`.
