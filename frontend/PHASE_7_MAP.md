# Phase 7 — HueHub + Solagram + Bomb.fun 完全陌生产品重写

**与 Phase 5/6 的区别**：Phase 7 的 7 个前端**完全无参考**——不是 UniPass 自家产品，没有开源上游，生产 bundle 解压只有 `_assets`/`_modules` minified chunks。重建依赖生产截图 + 竞品对齐 + 业务猜测。

## 7 项映射

| # | `-oss` 目录 | 技术栈 | 用途 | 估工 | 状态 |
|---|---|---|---|---|---|
| 1 | `auto-dex-site-oss` | Vite + React + Tailwind + Solana web3 | HueHub Auto-DEX（自动交易策略执行 + 仓位管理） | 14 天 | 🟡 scaffold |
| 2 | `huehub-dex-site-oss` | Vite + React + Jupiter v6 API | HueHub 主 DEX（聚合 swap + 代币浏览） | 14 天 | 🟡 scaffold |
| 3 | `bomb-fun-site-oss` | Vite + React + `pumpdotfun-sdk` | Bomb.fun — Pump.fun 风格 Solana 发币 + bonding curve 交易 | 10 天 | 🟡 scaffold |
| 4 | `solagram-wallet-oss` | Telegram Mini App + React + Solana web3 | Solagram TG 原生钱包（`@telegram-apps/sdk-react` + wallet） | 10 天 | 🟡 scaffold |
| 5 | `solagram-web-site-oss` | Astro | Solagram 官网（intro / download / legal） | 4 天 | 🟡 scaffold |
| 6 | `blinks-miniapp-oss` | Next.js 14 + `@solana/actions` | Solana Blinks demo（publish Action + render preview） | 3 天 | 🟡 scaffold |
| ~~7~~ | ~~`hongkong-wanxiang-festival`~~ | ~~—~~ | ~~过时活动页~~ | — | ❌ **砍掉**（按 master plan） |

**合计估工：55 人日** ≈ **11 周**。是 Phase 6 的 ~2 倍（30 人日）——因为无参考。

## 当前状态

✅ **6 个 scaffold 全部落地** — `scripts/phase7-check.sh` 通过，接入 `scripts/ci-check.sh` 作第 37 号检查项。

每个 scaffold 含：
- `package.json`（dev/build/test scripts）
- `tsconfig.json`（strict TS）
- 可运行入口（React/Astro/Next.js）
- `scripts/build.sh`（统一 npm/pnpm/yarn 识别）
- `README.md` + `UPSTREAM`（标注为 greenfield）

## 关键集成决策

### `auto-dex-site` / `huehub-dex-site`

- Solana wallet adapter 具体钱包清单需从生产截图决定
- Auto-DEX 后端已在 `backend-python/automatic-strategy-executor` —— 前端需封装策略模板 + P/L 图表
- Jupiter v6 API 用于 huehub-dex 的 swap route

### `bomb-fun-site`

- `pumpdotfun-sdk` 覆盖 3 阶段：create / pre-graduation trade / graduate to Raydium
- 配合后端 `backend-rust/huehub-token-distributor` 做空投/分发

### `solagram-wallet`

- Telegram Mini App context detection（`window.Telegram.WebApp`）
- 钱包生成策略：`@solana/web3.js` Keypair + 加密存储到 TG cloud storage
- 需要 bot backend（不在本仓）

### `blinks-miniapp`

- Solana Actions 官方 SDK
- 示例：Jupiter swap action / Nouns vote action

## 砍掉的一项

`hongkong-wanxiang-festival` — 2024 香港万象节活动页。master plan 明确标注"丢掉（过时活动）"。仓库中 `*-src/` 已移除或不存在。

## 剩余工作（~55 人日）

UI/UX 从生产截图复刻 + 钱包集成 + 真实 API wiring。Phase 7 是**设计工作而非工程工作**—— scaffold 本质上是交付了可扩展的代码框架，业务发现仍需在会话外完成。
