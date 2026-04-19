# 完整重建主计划

> 目标：所有源码都能维护，所有二进制都能从源码重建，所有前端都能改 UI。
> 基线日期：2026-04-18
> 总工作量估计：**14-22 周**（1 人全职），可通过并行砍半。

---

## 总览：4 个并行轨道

```
Track A: 核心交易（必须最先完成，其他一切的基础）      → Phase 1-2
Track B: 基础设施（ELF 替换 + UniPass 全家桶）        → Phase 3-4
Track C: 前端重写（HueHub 4 个 + UniPass 碎片）       → Phase 5-7
Track D: 工程化（CI/CD + 测试 + 文档 + 部署）         → 贯穿始终
```

---

# Track A — 核心交易栈（4-5 周，最高优先级）

## Phase 1：`trading-tracker-oss` 完成 ✅ 已启动

**当前**：Session 1-2 完成，skeleton + substreams 流 + cursor 持久化已跑通。

| Session | 内容 | 估计 | 状态 |
|---|---|---|---|
| 1 | Cargo 骨架 + 依赖解决 | - | ✅ |
| 2 | substreams 流 + redb cursor + reorg | - | ✅ |
| 3 | `program_ids` 分类器 + `PoolPrice::from_trade_data` + `handle_block` 解码/广播 + 12 单测 | - | ✅ |
| 4 | `tests/integration.rs` (5 条) + `Dockerfile` + `docker-compose.example.yml` + 部署文档 | - | ✅ |
| 5 (可选) | Prometheus `/metrics` + 账户快照 + 灰度部署 | 1 周 | ⏳ |

**产出**：`backend-rust/trading-tracker-oss/` 完整替代 `backend-bin/trading-tracker/` ELF。

## Phase 2：`dexauto-server` 策略引擎验证（1-2 周）

现状：0 编译错误，`nest build` 通过。但**没跑过**。

| 任务 | 估计 |
|---|---|
| 按 `dev.env` 列出所有依赖（pg、redis、ClickHouse、各 API key） | 半天 |
| 起 docker-compose（pg + redis + clickhouse + mock solana） | 1 天 |
| `npm run start:dev` 跑通，修运行时错误 | 2-3 天 |
| 跑 `npm test`，修失败用例 | 2 天 |
| 接上 `trading-tracker-oss`（替换掉原 ELF 的 JSON-RPC） | 1 天 |
| 端到端演练：mock 一笔链上交易，策略识别并"下单"到 mock RPC | 2-3 天 |

**产出**：策略引擎真的能从配置启动，消费价格源，发出订单。

---

# Track B — 基础设施替换（6-8 周）

## Phase 3：9 个有上游的 ELF 替换（3-4 周）

每个遵循同一套流程：**验证上游版本 → 对比 binary BuildInfo → 打补丁 → 重编译 → 对 diff 接口兼容**。

| 顺序 | 二进制 | 上游 | 类型 | 估计 |
|---|---|---|---|---|
| 1 | `stackup-bundler` | `upstream/stackup-bundler/` | Go | **2 天**（fork，有 diff） |
| 2 | `dexauto-data-center/substreams-sink-sql` | `upstream/substreams-sink-sql/` | Go | **1 天**（原版未改） |
| 3 | `apple-id-public-key` | `upstream/UniPass-OpenID-Auth/` | Rust | **3 天** |
| 4 | `dkim-and-open-id-monitor` | `upstream/UniPass-OpenID-Auth/`（同仓） | Rust | **2 天** |
| 5 | `asset-migrator` | `upstream/utxo-allocator/` | Rust | **3 天** |
| 6 | `paymaster-service` | `upstream/account-abstraction/` | Rust | **3 天** |
| 7 | `unipass-snap-service` | `upstream/UniPass-Snap/` | Node | **3 天**（注意本地 binary 目录是空的） |
| 8 | `unipass-wallet-tss` | `upstream/UniPass-Tss-Lib/` | Rust | **4 天**（已有 `backend-rust/tss-ecdsa-server` 似乎是它） |
| 9 | `unipass-wallet-zk-server` | `upstream/UniPass-email-circuits/` | Rust + circom | **5 天**（zk 构建慢） |

**共约 26 人日 ≈ 4 周。** 每个任务产物：
- `backend-rust/<name>-src/` 或 `backend-go/<name>-src/`
- `BUILD.md` 说明上游 commit + 本地补丁
- `Dockerfile` + `cargo-build-reproducible.sh`

## Phase 4：3 个纯闭源 ELF（2-3 周）

| 二进制 | 策略 | 估计 |
|---|---|---|
| `trading-tracker` | 已在 Track A 重写 | - |
| `denver-airdrop-rs` (14 MB, Rust) | 基于 `upstream/_reconstructed/denver-airdrop-rs/` 骨架 + `HUMAN_GUIDE.md` 逐函数实现 | **2 周**（519 行骨架，13 个 tracing 点已标注） |
| `huehub-rgbpp-indexer` (18 MB, Rust) | **不重写**，改为：基于 `upstream/rgbpp` + 本地薄 API 层对外提供 `RgbppIndexer` 接口 | **2 周**（适配器模式） |

**注**：`dexauto-data-center` 本体是开源 `substreams-sink-sql` + 开源 `.spkg` 包，不是闭源产品——Phase 3 已覆盖。

---

# Track C — 前端重写（6-10 周）

## Phase 5：UniPass 有上游的前端还原（2 周）

**仓库已克隆在 upstream，直接用上游替换 minified bundle**：

| 本地目录 | 上游 | 估计 |
|---|---|---|
| `frontend/payment-specifications-src/` | `upstream/UniPass-Wallet-Docs/` | 1 天 |
| `frontend/payment-swagger-src/` | `upstream/UniPass-Wallet-Docs/` | 1 天 |
| `frontend/solana-wallet-mini-app-demo-src/` | `upstream/smart-account-vite-demo/` | 1 天 |
| `frontend/unipass-app-h5-src/` | `upstream/unipass-frontend-test/` | 2 天 |
| `frontend/unipass-snap-frontend-src/` | `upstream/UniPass-Snap/` | 2 天 |
| `frontend/unipass-snap-react-src/` | `upstream/UniPass-Wallet-Snap/`（或保留已解的 72 个 ts） | 2 天 |
| `frontend/unipass-wallet-js-src/` | `upstream/UniPass-Wallet-JS/` | 2 天 |
| `frontend/utxo-swap-site-src/` | `upstream/utxo-stack-sdk/` + 薄 UI | 3 天 |

**共 14 人日 ≈ 2 周。**

## Phase 6：UniPass 闭源前端重写（4 个，3-4 周）

| 目录 | 用途 | 重写策略 | 估计 |
|---|---|---|---|
| `unipass-auth0-verify-code-src/` | 验证码输入页 | Next.js 最小实现 | 1 天 |
| `unipass-cms-frontend-src/` | 内部 CMS | React-Admin 模板 | 3-5 天 |
| `unipass-payment-web-src/` | 支付 Web | 调用 `unipass-wallet-js` | 1 周 |
| `unipass-wallet-frontend-src/` | 主钱包 UI | 基于 `UniPass-Wallet-JS` + 模仿生产页面 | 2 周 |
| `unipass-wallet-official-website-src/` | 营销站 | 静态站（Hugo/Astro） | 3 天 |

## Phase 7：HueHub + Solagram/Bomb.fun（4-6 周，最重）

**核心：这些产品无任何源码可参考**。策略：

| 目录 | 用途 | 策略 |
|---|---|---|
| `frontend/auto-dex-site/` | HueHub 自动交易 DEX | **复制 production bundle 的页面截图 → 重写 React + Tailwind** |
| `frontend/huehub-dex-site/` | HueHub 主 DEX | 同上 |
| `frontend/bomb-fun-site/` | Bomb.fun 发币 | Pump.fun 类似，用开源 `pumpdotfun-sdk` |
| `frontend/solagram-wallet-src/` | Solagram TG Wallet | Telegram Mini App，用 `@tonconnect/sdk` 类模板 |
| `frontend/solagram-web-site-src/` | 官网 | 静态站 |
| `frontend/hongkong-wanxiang-festival-src/` | 活动页 | 丢掉（过时活动） |
| `frontend/blinks-miniapp-src/` | Solana Blinks demo | 用 `@solana/actions` SDK 从零写 |

**估计 4-6 周**，视对生产 UI 还原度要求而定。

---

# Track D — 工程化（贯穿所有阶段）

## 必须先搭建（Phase 1 开始前 1 周）

| 项 | 作用 |
|---|---|
| **Monorepo 管理** | `pnpm workspaces` 管 node，`cargo workspace` 管 Rust |
| **CI** | GitHub Actions：`tsc --noEmit` + `cargo check --all` + `cargo test` + `npm test` |
| **容器** | 每个服务一个 Dockerfile + `docker-compose.dev.yml` 一键起全栈 |
| **机密管理** | `.env.example` + 1Password/Vault 指引 |
| **监控** | tracing → Loki，metrics → Prometheus，panel → Grafana |

## 每个新产物都必须有

- `README.md` 至少 5 段：Overview / Build / Run / Config / Test
- `tests/` 至少 1 条 smoke test
- `Dockerfile`（生产用 distroless）
- 版本锁定：Cargo.lock / package-lock.json 入库

---

# 具体的甘特时序（建议单人推进顺序）

```
周 1-2   ▓▓ Track D 工程化基线（CI/Docker compose 骨架）
周 1-3   ▓▓▓ Track A Phase 1 (trading-tracker-oss Session 3-5)
周 4-5   ▓▓ Track A Phase 2 (dexauto-server 跑通)
周 6-9   ▓▓▓▓ Track B Phase 3 (9 个 ELF 用上游替换)
周 10-12 ▓▓▓ Track B Phase 4 (denver-airdrop-rs 重写 + rgbpp 适配器)
周 13-14 ▓▓ Track C Phase 5 (UniPass 上游前端对齐)
周 15-18 ▓▓▓▓ Track C Phase 6 (UniPass 闭源前端重写)
周 19-24 ▓▓▓▓▓▓ Track C Phase 7 (HueHub + Solagram + Bomb 重写)
```

**总计：24 周单人全职**；2 人全职并行 12-14 周；3 人 8-10 周。

---

# 决策/取舍建议

**强烈建议砍掉的部分**（除非有明确业务理由）：

| 项 | 理由 |
|---|---|
| `hongkong-wanxiang-festival` | 过时活动页 |
| `unipass-wallet-official-website` | 营销站，可以一张 Notion 页代替 |
| `blinks-miniapp` | Solana Blinks demo，可直接用官方示例 |
| `solana-wallet-mini-app-demo` | 纯 demo |
| `unipass-auth0-verify-code` | 6 行代码的页，跟主钱包合并即可 |
| `unipass-cms-frontend` | 后台管理可用 Retool/NocoBase 替代 |

砍掉这些省 **3-4 周**，总工期压到 **16-20 周**。

---

# 风险 & 缓解

| 风险 | 缓解 |
|---|---|
| 上游版本与生产二进制接口不一致 | 每个 ELF 替换前先 `ghidra-diff` + `nm`/`strings` 比对导出符号 |
| HueHub/Solagram 前端无法 100% 还原 | 保留原 minified bundle 作为 fallback，逐页替换 |
| `denver-airdrop-rs` 重写后行为偏差 | 用合约日志做 golden test：同一批合约事件，新旧二进制产物字节比对 |
| zk-server 电路编译慢 | Phase 3-9 预留 1 周 buffer；用 trusted setup 的 MPC 产物 |
| 团队不熟悉某栈（Rust/Go/Solana/CKB） | 每 Phase 开头留 2 天"上手"时间 |

---

# 已执行（2026-04-18）

基于 `CUT_LIST.md` 决策（用户选择 #2/#3/#6 保留，#1/#5 是死项 + #4 有上游）：

| 项 | 动作 | 位置 |
|---|---|---|
| #1 `hongkong-wanxiang-festival` | 🗑 归档（2023 活动已结束） | `_archived/frontend/` |
| #5 `unipass-auth0-verify-code` | 🗑 归档（空目录） | `_archived/frontend/` |
| #4 `solana-wallet-mini-app-demo` | ✅ 用 `upstream/smart-account-vite-demo/` 替换 minified bundle | `frontend/solana-wallet-mini-app-demo/` 现在是真源码 |

净收益：约 **6-8 人日**，新的 Track C 中 1 项从"待重写"变"已完成"。

剩下待处理的可砍/降级项：
- #2 `unipass-wallet-official-website` → Astro 静态站重建（1 天，列在 Phase 5）
- #3 `blinks-miniapp` → 用官方 `@solana/actions` 模板（半天，列在 Phase 6）
- #6 `unipass-cms-frontend` → NocoBase 或 Ant Design Vue 最小实现（3-5 天，列在 Phase 6）

---

# 下一步（立刻可做）

1. **搭 Track D 基线**（3-5 天）：monorepo + CI + docker-compose
2. **并行启动 Track A Phase 1 Session 3**（trading-tracker-oss DEX parser）

建议现在就做 1+2：CI + trading-tracker Session 3 并行。
