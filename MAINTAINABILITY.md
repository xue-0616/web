# 可维护性评估 —— 哪些部分没有完整源码？

> 按"能不能改代码 → 能不能重新编译 → 能不能长期维护"分 4 档。

---

## 🔴 第 1 档：完全无源码（3 个私有 Rust 二进制）

**最大的风险点**。只有编译好的 ELF，原作者没有公开仓库，也不在你本地的 `backend-rust/` 或 `backend-node/` 里。

| 二进制 | 大小 | 用途 | 我们做到哪 |
|---|---:|---|---|
| `backend-bin/denver-airdrop-rs/denver-airdrop-rs` | 14 MB | NFT 空投监听器（EVM） | 骨架 519 行 + `HUMAN_GUIDE.md` |
| `backend-bin/huehub-rgbpp-indexer/rgbpp` | 18 MB | RGB++ 资产索引器（BTC+CKB） | 骨架 5 328 行 + `HUMAN_GUIDE.md` |
| `backend-bin/trading-tracker/trading-tracker` | 22 MB | Solana DEX 价格追踪器 | 骨架 2 814 行 + `HUMAN_GUIDE.md` |

**可以做的**：改配置、换 RPC、换数据库路径、重启
**做不到的**：改业务逻辑、修 bug、增加新 DEX、升级依赖
**重建成本估计**：
- `denver-airdrop-rs` —— 2-3 人日（逻辑简单，HUMAN_GUIDE 已给出全部 13 个 tracing 位置）
- `trading-tracker` —— 1-2 人周（可基于上游 `streamingfast/solana-token-tracker` 开源框架 + 本地 4 种 DEX 解析）
- `huehub-rgbpp-indexer` —— **不建议重写**，144 个 stubs + 186 个依赖；实际路径：直接用开源上游 `utxostack/rgbpp` + 在外面包 API 适配层

重建材料：
- `@/home/kai/桌面/55182/链上自动化交易源码/upstream/_reconstructed/denver-airdrop-rs/HUMAN_GUIDE.md`
- `@/home/kai/桌面/55182/链上自动化交易源码/upstream/_reconstructed/huehub-rgbpp-indexer/HUMAN_GUIDE.md`
- `@/home/kai/桌面/55182/链上自动化交易源码/upstream/_reconstructed/trading-tracker/HUMAN_GUIDE.md`

---

## 🔴 第 2 档：前端关键产品，几乎无源码（4 个 HueHub 私有 Web 应用）

**HueHub 整个品牌的前端都是闭源**。webpack 反编译后只拿到 1-20 个碎片文件（都是 vendored 的三方库），真正的业务代码不见。

| 目录 | 大小 | 有效文件 | 状态 |
|---|---:|---:|---|
| `frontend/auto-dex-site-src/` | 19 MB | 20 个碎片 | 🔴 HueHub 核心 DEX 前端，无源 |
| `frontend/huehub-dex-site-src/` | 4.9 MB | 4 个碎片 | 🔴 HueHub 主站，无源 |
| `frontend/bomb-fun-site-src/` | 748 KB | 1 个 bundle | 🔴 Bomb.fun 前端，无源 |
| `frontend/solagram-wallet-src/` | 6.4 MB | 2 个 bundle | 🔴 Solagram 钱包，无源 |

**可以做的**：部署已有的 bundle、改 config JSON
**做不到的**：改 UI、加功能、修 bug
**重建成本**：每个网站 2-4 人周（当作全新项目做）

---

## 🟡 第 3 档：有公共上游仓库可参考（8 个后端二进制 + 7 个前端项目）

本地是 fork 或编译版，但 upstream 已克隆到 `upstream/*`，**可以对 diff 后在上游基础上叠补丁**。

### 后端（8 个）

| 本地二进制 | 上游仓库 | 用途 |
|---|---|---|
| `backend-bin/apple-id-public-key/` | `upstream/UniPass-OpenID-Auth/` | Apple/OpenID 公钥获取 |
| `backend-bin/asset-migrator/` | `upstream/utxo-allocator/` | UTXO 资产迁移 |
| `backend-bin/dexauto-data-center/` | `upstream/substreams-sink-sql/` + `upstream/solana-programs/` | SQL 数据沉淀（开源原版） |
| `backend-bin/dkim-and-open-id-monitor/` | `upstream/UniPass-OpenID-Auth/` | DKIM 监控（与上面同仓） |
| `backend-bin/paymaster-service/` | `upstream/account-abstraction/` | ERC-4337 paymaster |
| `backend-bin/stackup-bundler/` | `upstream/stackup-bundler/` | AA bundler（Go 源码） |
| `backend-bin/unipass-snap-service/` | `upstream/UniPass-Snap/` | MetaMask Snap 服务端 |
| `backend-bin/unipass-wallet-tss/` | `upstream/UniPass-Tss-Lib/` | MPC 门限签名 |
| `backend-bin/unipass-wallet-zk-server/` | `upstream/UniPass-email-circuits/` | zk-email 服务端 |

### 前端（7 个）

| 本地目录 | 上游仓库 | 说明 |
|---|---|---|
| `frontend/payment-specifications-src/` | `upstream/UniPass-Wallet-Docs/` | 文档仓 |
| `frontend/payment-swagger-src/` | `upstream/UniPass-Wallet-Docs/` | 同上 |
| `frontend/solana-wallet-mini-app-demo-src/` | `upstream/smart-account-vite-demo/` | Vite demo 模板 |
| `frontend/unipass-app-h5-src/` | `upstream/unipass-frontend-test/` | H5 前端测试脚手架 |
| `frontend/unipass-snap-frontend-src/` | `upstream/UniPass-Snap/` | Snap 前端（同仓） |
| `frontend/unipass-snap-react-src/` | `upstream/UniPass-Wallet-Snap/` | React Snap 钱包 |
| `frontend/unipass-wallet-js-src/` | `upstream/UniPass-Wallet-JS/` | 也有 `frontend/unipass-wallet-js-github/` |
| `frontend/utxo-swap-site-src/` | `upstream/utxo-stack-sdk/` | UTXO Stack SDK |

**维护流程**：
```bash
# 看本地版本改了多少
diff -r upstream/<repo>/ backend-bin/<name>/_scaffold/

# 如果改得不多 → 把补丁应用到上游仓库，重新编译
# 如果改得很多 → 当作私有分支维护
```

---

## 🟡 第 4 档：前端反编译但源码较完整（5 个 UniPass Web 项目）

webpack source map 恢复出了大量 .ts/.tsx 文件（几百到上千个），**基本可读可改**，但：
- 文件名可能被 webpack 重命名
- 项目结构需要人工整理
- 依赖版本需要自己对齐

| 目录 | 恢复文件数 | 备注 |
|---|---:|---|
| `frontend/unipass-cms-frontend-src/` | 1719 | CMS 前端 |
| `frontend/unipass-snap-frontend-src/` | 1228 | Snap 前端（同时有 upstream） |
| `frontend/unipass-payment-web-src/` | 620 | 支付 Web |
| `frontend/unipass-wallet-js-src/` | 395 | Wallet JS（有 upstream + github/ 对照） |
| `frontend/solagram-web-site-src/` | 148 | Solagram 官网 |

**可以做的**：读代码、改 UI、加功能
**做不到的**：直接 `npm run build` —— 缺 package.json / 构建脚本，需要自己补

---

## 🟢 第 5 档：完整源码在手，正常维护（26 个项目）

### `backend-node/` 16 个 Node.js / NestJS 后端（完整 TS）
```
btc-assets-api                huehub-dex-backend            opentg-backend
dexauto-server  ★             huehub-dex-dobs-backend        protonmail-bridge
mystery-bomb-box-backend      node-monitor                   solagram-backend
unipass-activity-backend      unipass-cms-backend            unipass-wallet-backend
unipass-wallet-custom         unipass-wallet-extend          unipass-wallet-oauth
utxoswap-paymaster-backend
```
★ `dexauto-server` 就是你 IDE 里正在看的那个。

### `backend-rust/` 9 个 Rust 后端（完整源）
```
dexauto-trading-server    huehub-token-distributor  ★    payment-server
tss-ecdsa-server          unipass-bridge-validator       unipass-wallet-relayer
utxoswap-farm-sequencer   utxoswap-sequencer
```
★ `huehub-token-distributor` 也是你 IDE 里打开的。

### `backend-python/` 1 个 Python
```
devops-data-sentinel
```

这 26 项**随时可以改代码、`cargo build` / `npm run build` / `python setup.py` 出包**，正常维护不成问题。

---

## 📊 一张表总结

| 档位 | 数量 | 源码情况 | 维护能力 |
|---|---:|---|---|
| 🔴 第 1 档（私有 Rust） | 3 | 骨架 + 人话指南 | 只能改配置，不能改业务 |
| 🔴 第 2 档（HueHub 前端） | 4 | 几乎空壳 | 只能改 config，不能改 UI |
| 🟡 第 3 档（有上游可对 diff） | 8 + 7 = **15** | 上游 + 本地 fork | 可基于上游改 |
| 🟡 第 4 档（webpack 反编译可读） | 5 | 几百到上千 TS 文件 | 可读可改，构建链需补 |
| 🟢 第 5 档（完整源码） | 26 | 完整 | 完全正常维护 |

**总计 61 个组件**，其中 **7 个几乎完全无法维护**（第 1 档 3 个 + 第 2 档 4 个），**15 个需要额外对 diff 工作**（第 3 档），其余 **39 个正常**。

---

## 🎯 优先级建议

**立即需要关注的**（可能会"部署挂了没法修"）：
1. `trading-tracker` —— Solana 交易追踪器，业务关键
2. `huehub-rgbpp-indexer` —— RGB++ 索引，HueHub DEX 必需
3. `auto-dex-site` / `huehub-dex-site` —— HueHub 整个 DEX 前端

**建议行动**：
- **立刻**：给第 1、2 档的 7 个组件做**运行时快照备份**（当前可用的 ELF + bundle，以及配置文件），至少保证"重装一次能跑起来"
- **本季度**：基于 HUMAN_GUIDE 重写 `denver-airdrop-rs`（小，练手用）
- **本半年**：基于上游 `streamingfast/solana-token-tracker` 重建 `trading-tracker`
- **长期**：把 HueHub DEX 前端从 fork 路径改为基于开源 DEX SDK（例如 Uniswap Interface / Raydium UI）重建

**不建议**：
- 不要尝试原地改 `backend-bin/*` 里任何 ELF —— 没有源码，改不动
- 不要尝试重建 `huehub-rgbpp-indexer` —— 工作量超过重新买一份类似服务
