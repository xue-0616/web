# 项目索引 (PROJECT_INDEX)

> 本文件由 Harbor 镜像拉取 + 本地反编译整合后生成。每个项目标注**语言 / 来源 / 状态 / 用途**。
> 
> **来源图例:**
> - `local` — 原始本地源码（未丢失）
> - `harbor` — 本次从 Harbor 镜像拉取并提取
> - `decomp` — 从 dist/minified 反编译/反混淆
> - `git` — 含 `.git` 历史记录
>
> **状态图例:**
> - ✅ 可编译 / 可开发
> - 🟡 仅 dist 或反混淆，可读但需整理
> - ❌ 仅二进制，不可修改

## 🔥 核心交易系统（自动化策略）

| 项目 | 语言 | 来源 | 状态 | 用途 |
|------|------|------|------|------|
| `backend-node/dexauto-server/` | NestJS / TS | local | ✅ | **核心**自动化交易后端。含升级版 Smart Money 策略 Phase 1-4: `automatic-strategy/`、`automatic-strategy-syncer/`、`geyser-subscriber/`、`wallet-scorer/`、`position-manager/`、`position-monitor/`、`smart-wallet-source/` |
| `backend-rust/dexauto-trading-server/` | Rust | local | ✅ | Solana DEX 交易执行引擎（CPI、tx-builder、api、entity），含 Raydium / Jupiter / Pump 等 CPI |
| `backend-bin/dexauto-data-center/` | Substreams/Rust | harbor | ❌ | Solana DEX Trades 数据采集（`substreams-sink-sql` + `.spkg`），仅二进制 |
| `backend-bin/trading-tracker/` | Rust | harbor | ❌ | 交易跟踪器，仅二进制 |
| `frontend/auto-dex-site-src/_modules/` | React/Vite | decomp | 🟡 | DEX 自动交易前端 UI（含 TradingView 图表），5.5 MB 反混淆 JS |

## 💰 支付 / 钱包基础设施

| 项目 | 语言 | 来源 | 状态 | 用途 |
|------|------|------|------|------|
| `backend-rust/payment-server/` | Rust | local | ✅ | UniPass Payment 服务（= Harbor `unipass-payment-service`） |
| `backend-rust/unipass-wallet-relayer/` | Rust | local | ✅ | Multi-chain 钱包 Relayer |
| `backend-rust/tss-ecdsa-server/` | Rust | local | ✅ | TSS 门限签名服务（= Harbor `unipass-wallet-tss`） |
| `backend-rust/unipass-bridge-validator/` | Rust | local | ✅ | 跨链 Bridge 验证器 |
| `backend-bin/paymaster-service/` | Rust | harbor | ❌ | ERC-4337 Paymaster，仅二进制 |
| `backend-bin/stackup-bundler/` | Go | harbor | ❌ | ERC-4337 Bundler 参考实现，仅二进制 |
| `backend-bin/asset-migrator/` | Rust | harbor | ❌ | 资产迁移器，仅二进制 |
| `backend-node/unipass-wallet-backend/` | NestJS | local | ✅ | UniPass 钱包主后端 |
| `backend-node/unipass-wallet-custom/` | NestJS | decomp | 🟡 | 钱包第三方 App 定制认证（web3auth、Dashboard），**从 Harbor dist 反编译恢复 121 .ts** |
| `backend-node/unipass-wallet-extend/` | NestJS | decomp | 🟡 | FatPay 支付扩展，**从 Harbor dist 反编译恢复 30 .ts** |
| `backend-node/unipass-wallet-oauth/` | NestJS | local | ✅ | OAuth 登录 |
| `backend-bin/unipass-snap-service/` | Rust | harbor | ❌ | MetaMask Snap 后端（Rust 二进制，含逆向文档） |
| `backend-node/utxoswap-paymaster-backend/` | NestJS | local | ✅ | UtxoSwap Paymaster 后端 |

## 🌉 UtxoSwap / Hue / RGB++ 生态

| 项目 | 语言 | 来源 | 状态 | 用途 |
|------|------|------|------|------|
| `backend-rust/utxo-swap-sequencer/` | Rust | local | ✅ | UtxoSwap 排序器主节点 |
| `backend-rust/utxoswap-farm-sequencer/` | Rust | local | ✅ | UtxoSwap 流动性挖矿排序器 |
| `backend-rust/huehub-token-distributor/` | Rust | local | ✅ | HueHub 代币分发器 |
| `backend-node/huehub-dex-backend/` | NestJS | local | ✅ | HueHub DEX 后端 |
| `backend-node/huehub-dex-dobs-backend/` | NestJS | local | ✅ | HueHub DOBS 扩展 |
| `backend-node/btc-assets-api/` | NestJS | local | ✅ | BTC Assets API (RGB++) |
| `backend-bin/huehub-rgbpp-indexer/` | Rust | harbor | ❌ | RGB++ 索引器，仅二进制 |

## 🎮 其他后端项目

| 项目 | 语言 | 来源 | 状态 | 用途 |
|------|------|------|------|------|
| `backend-node/solagram-backend/` | NestJS | local | ✅ | Solagram 社交后端 |
| `backend-node/opentg-backend/` | NestJS | local | ✅ | OpenTG 后端 |
| `backend-node/mystery-bomb-box-backend/` | NestJS | local | ✅ | Mystery Bomb Box 抽奖 |
| `backend-node/unipass-cms-backend/` | NestJS | local | ✅ | UniPass CMS 后台 |
| `backend-node/unipass-activity-backend/` | NestJS | local | ✅ | UniPass 活动后端 |
| `backend-node/node-monitor/` | Node.js | harbor+git | ✅ | **EVM 链节点 / Validator 监控**（含完整 git 历史） |
| `backend-node/protonmail-bridge/` | 3rd-party | harbor | ❌ | ProtonMail Bridge，第三方邮件网关 |
| `backend-python/devops-data-sentinel/` | Python | harbor | ✅ | k8s Pod Sequencer 健康检查 (Prometheus/Thanos 探针) |
| `backend-bin/apple-id-public-key/` | Rust | harbor | ❌ | Apple Sign In 公钥监控，仅二进制 |
| `backend-bin/dkim-and-open-id-monitor/` | Rust | harbor | ❌ | DKIM / OpenID 监控，仅二进制 |
| `backend-bin/denver-airdrop-rs/` | Rust | harbor | ❌ | Denver 活动空投脚本，仅二进制 |
| `backend-bin/unipass-wallet-zk-server/` | Rust | harbor | ❌ | 钱包 ZK 证明服务，仅二进制 |

## 🖥️ 前端项目

### 完整源码 (有 clean `.tsx` / `.vue`)

| 项目 | 框架 | 来源 | 状态 | 用途 |
|------|------|------|------|------|
| `frontend/unipass-app-h5/` + `-src/` | Vue | local + decomp | ✅ | UniPass App H5 移动端钱包 |
| `frontend/unipass-wallet-frontend/` + `-src/` | Vue | local + decomp | ✅ | UniPass 钱包网页 |
| `frontend/unipass-wallet-js-github/` | Vue | github | ✅ | UniPass JS SDK 演示（git clone） |
| `frontend/unipass-snap-github/` + `unipass-wallet-snap-github/` | React | github | ✅ | MetaMask Snap 源码 |
| `frontend/unipass-wallet-official-website/` + `-src/` | Vue | local + decomp | ✅ | 官网 |
| `frontend/unipass-cms-frontend/` + `-src/` | Vue | local + decomp | ✅ | CMS 后台 |
| `frontend/unipass-payment-web/` + `-src/` | Vue | local + decomp | ✅ | 支付前端 |
| `frontend/unipass-snap-frontend/` + `-src/` | React | local + decomp | 🟡 | Snap 前端 |

### 反混淆产物 (仅 deobfuscated.js)

| 项目 | 类型 | 来源 | 状态 | 用途 |
|------|------|------|------|------|
| `frontend/auto-dex-site/` + `-src/` | React/Vite | local + decomp | 🟡 | **DEX 自动交易 UI**（核心前端！） |
| `frontend/bomb-fun-site/` + `-src/` | Gatsby | local + decomp | 🟡 | Bomb Fun 活动页 |
| `frontend/huehub-dex-site/` + `-src/` | Next.js | local + decomp | 🟡 | HueHub DEX 前端 |
| `frontend/solagram-web-site/` + `-src/` | Next.js | local + decomp | 🟡 | Solagram Web |
| `frontend/utxo-swap-site/` + `-src/` | Next.js | local + decomp | 🟡 | UtxoSwap 前端 |
| `frontend/blinks-miniapp/` + `-src/` | React/Vite | harbor + decomp | 🟡 | Solana Blinks 小程序（本次新增） |
| `frontend/solagram-wallet/` + `-src/` | React/Vite | harbor + decomp | 🟡 | Solagram 钱包演示（本次新增） |
| `frontend/solana-wallet-mini-app-demo/` + `-src/` | React/Vite | harbor + decomp | 🟡 | Solana 钱包 mini app demo（本次新增） |
| `frontend/unipass-snap-react/` + `-src/src/` | React/CRA | harbor + sourcemap | ✅ | Snap React UI（**141 个 .tsx/.ts/.scss 已从 sourcesContent 完整还原**） |
| `frontend/unipass-wallet-js/` + `-src/` | Umi.js | harbor + decomp | 🟡 | 钱包 JS SDK 演示页（本次新增，4 个 async chunks 反混淆） |
| `frontend/hongkong-wanxiang-festival/` + `-src/` | React/Vite | harbor + decomp | 🟡 | 香港万象节活动页（本次新增） |

### 仅静态资源 (index.html + 图标，无可读逻辑)

| 项目 | 类型 | 来源 | 状态 | 用途 |
|------|------|------|------|------|
| `frontend/payment-specifications/` | Swagger UI | harbor | ❌ | Payment API 文档 |
| `frontend/payment-swagger/` | Swagger UI | harbor | ❌ | Payment API 文档（另一版本） |
| `frontend/unipass-auth0-verify-code/` | HTML | harbor | ❌ | Auth0 验证码跳转页 |

## 📊 统计

| 分类 | 项目数 | 备注 |
|------|--------|------|
| `backend-node/` | 16 | NestJS/Node.js，均有 package.json |
| `backend-rust/` | 9 | 全部有 Cargo.toml 和 src/ |
| `backend-python/` | 1 | devops-data-sentinel |
| `backend-bin/` | 12 | 仅二进制归档（Rust/Go） |
| `frontend/` | 40（含 -src 对+github） | 含 1 个 sourcemap 完整还原（unipass-snap-react） |
| **总计** | **78 个独立项目** | — |

## 📁 其他目录说明

- `configs/` — 各服务的 `.env` / `docker-compose` 配置样例
- `docs/` — 审计文档、业务文档
- `tools/` — 辅助脚本（反编译器等）
- 根目录 `*.md` — 审计报告、升级方案文档

## �️ backend-bin 反编译骨架

`backend-bin/*/` 下每个 Rust 二进制均已产生两级恢复产物：

- **`_recovery/`** — 符号表、模块路径、SQL schema、HTTP 路由、crate 依赖清单
- **`_scaffold/`** — ✅ 可 `cargo check` 通过的 Cargo workspace 骨架（结构体 + 方法签名 + `todo!()` body）

详见 `@/home/kai/桌面/55182/链上自动化交易源码/backend-bin/BACKEND_BIN_RECOVERY.md`

| 项目 | Rust workspace crates | `.rs` 文件 | 可 cargo check |
|------|---------------------|-----------|----------------|
| `apple-id-public-key` | 1 | 1 | ✅ |
| `asset-migrator` | 11 | 39 | ✅ |
| `denver-airdrop-rs` | 1 | 7 | ✅ |
| `dkim-and-open-id-monitor` | 1 | 9 | ✅ |
| `huehub-rgbpp-indexer` | 3 | 40 | ✅ |
| `paymaster-service` | 1 | 8 | ✅ |
| `trading-tracker` | 1 | 18 | ✅ |
| `unipass-snap-service` | 11 | 38 | ✅ |
| `unipass-wallet-tss` | 2 | 6 | ✅ |
| `unipass-wallet-zk-server` | 5 | 18 | ✅ |
| `dexauto-data-center` (Go 3rd-party) | - | - | N/A |
| `stackup-bundler` (Go 3rd-party) | - | - | N/A |

## �🔧 历史工具

- `/home/kai/桌面/55182/recovered/` — 中间反编译产物（可保留作 debug 参考）
- `/home/kai/桌面/55182/rebuilt/` — Rust 重建结果
- `/home/kai/桌面/55182/deploy/` — 部署产物 / 备份
- `/home/kai/桌面/55182/deploy/clean-source/` — 清理过的源码镜像（部分子目录为空占位）

---

> 本索引反映 **2026-04-17** 完成 Harbor 镜像全量同步后的状态。
>
> 已完全脱离 Harbor 依赖 — 所有源码 / 二进制已落盘到 `链上自动化交易源码/` 树。
