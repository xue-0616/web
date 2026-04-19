# Phase 5 — UniPass 前端上游对齐

**目标**：将 8 个从 minified bundle 反编译出来的 `*-src/` 目录替换为 `*-oss/` 目录，后者是对应开源上游仓库的**薄封装 + 版本钉**。`*-src/` 保留作反编译证据。

## 映射表

| 本地 `*-src/`（bundle 提取物） | 上游 | 上游内部路径 | 本地 `*-oss/` | 状态 |
|---|---|---|---|---|
| `payment-specifications-src/` | `upstream/UniPass-Wallet-Docs/` | `docs/wallet/payment/` 子目录 | `payment-specifications-oss/` | ✅ wrapped |
| `payment-swagger-src/` | `upstream/UniPass-Wallet-Docs/` | `docs/develop/` + swagger static | `payment-swagger-oss/` | ✅ wrapped |
| `solana-wallet-mini-app-demo-src/` | `upstream/smart-account-vite-demo/` | root (Vite + React) | `solana-wallet-mini-app-demo-oss/` | ✅ wrapped |
| `unipass-app-h5-src/` | `upstream/unipass-frontend-test/` | root (minimal H5 shell) | `unipass-app-h5-oss/` | 🟡 上游仅示意，建议重写 |
| `unipass-snap-frontend-src/` | `upstream/UniPass-Snap/` | `packages/site/` | `unipass-snap-frontend-oss/` | ✅ wrapped |
| `unipass-snap-react-src/` | `upstream/UniPass-Wallet-Snap/` | `packages/up-frontend/` | `unipass-snap-react-oss/` | ✅ wrapped |
| `unipass-wallet-js-src/` | `upstream/UniPass-Wallet-JS/` | 14 个 `packages/*` SDK | `unipass-wallet-js-oss/` | ✅ wrapped |
| `utxo-swap-site-src/` | `upstream/utxo-stack-sdk/` | `packages/{branch,leap}` + 薄 UI | `utxo-swap-site-oss/` | 🟡 SDK 就位，UI 层需二次封装 |

## 每个 `*-oss/` 目录的内容

```
<name>-oss/
├── README.md          # 说明：上游路径、对应 -src 的 evidence 映射、build 指令
├── UPSTREAM           # 一行：上游 git 来源（commit sha 如可获取）
└── scripts/
    └── build.sh       # 调上游的标准 build 命令
```

## 验证脚本

`scripts/phase5-check.sh` 遍历所有 8 个映射，确保 `upstream/<repo>/` 存在 + 包含有效 `package.json`（或 `docusaurus.config.js` 等 build entry）。不执行真正的 `npm install`（避免污染）—— 那是 Track D 里 per-PR CI 的职责。

## 与原计划估工对比

REBUILD_MASTER_PLAN.md Phase 5 估 14 人日（含实际 `pnpm install + build + e2e`），本轮仅完成映射落地 + wrapper 生成（约 2 人日）。
剩余 12 人日分布如下：

| 子项 | 待办 |
|---|---|
| `unipass-app-h5-oss` | 上游只是 `index.html` 演示，建议降级到 Phase 6（最小 H5 shell 重写） |
| `utxo-swap-site-oss` | SDK 就位但无 UI 层，需基于 `examples/` 扩展为完整站点（3 人日） |
| 其他 6 项 | 逐个 `pnpm install && pnpm build` 验证 → 对比 `*-src/` 里解包的 bundle size & 路由 → 修补差异（每项 1-2 人日） |

**本次交付：结构 + 映射 + build 脚手架已就位；功能验证推到 Phase 5 后半段。**
