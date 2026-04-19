# Phase 6 — UniPass 闭源前端绿地重写

**与 Phase 5 的区别**：Phase 5 的 8 个前端有开源上游可直接对齐；Phase 6 的 5 个**无任何源码参考**，需要从零写。生产的 `*-src/` 目录只含 nginx 默认占位页（bundle 提取失败，生产明显走了不同的 CDN/构建系统）。

## 5 个 Scaffold

| # | `-oss` 目录 | 技术栈 | 用途 | 估工 |
|---|---|---|---|---|
| 1 | `unipass-auth0-verify-code-oss` | Next.js 14 (App Router) | Auth0 OTP 6 位验证码输入页 | 1 天 · ✅ **完整实现** |
| 2 | `unipass-cms-frontend-oss` | Vite + React + React-Admin | UniPass 内部 CMS（users/transactions/tokens CRUD） | 5 天 · ✅ **核心实现** |
| 3 | `unipass-payment-web-oss` | Vite + React + `@unipass/wallet-js` | 支付页 Web（扫码、预览、签名） | 7 天 · ✅ **核心实现** |
| 4 | `unipass-wallet-frontend-oss` | Vue 3 + Vite + `UniPass-Wallet-JS` | 主钱包 UI（最复杂，多视图） | 14 天 · ✅ **核心实现** |
| 5 | `unipass-wallet-official-website-oss` | Astro 静态站 | 营销官网（6 页 × 2 语言） | 3 天 · ✅ **完整实现** |

**合计估工：30 人日 ≈ 6 周**（REBUILD_MASTER_PLAN.md 给的 3-4 周是激进估计；30 人日是保守估计）。

## 当前状态

✅ **Scaffold 全部 5 个就位** — `scripts/phase6-check.sh` 通过，接入 `scripts/ci-check.sh` 作第 36 号检查项。

每个 scaffold 都包含：
- `package.json` 带 `dev` / `build` script
- `tsconfig.json`（TypeScript 严格模式）
- 至少一个可渲染的入口（React 页面 / Vue 视图 / Astro 页面）
- `scripts/build.sh` 统一构建入口（npm/pnpm/yarn 自动识别）
- `README.md` + `UPSTREAM`（标记为 `NONE`，greenfield）

## 用 scaffold 的方式

```bash
cd frontend/unipass-auth0-verify-code-oss
npm install
npm run dev         # 开发热重载
npm run build       # 生产构建 → dist/
```

## Phase 6 剩余工作（~30 人日）

### `unipass-auth0-verify-code-oss`（1 天）

- 从生产截图还原 UI 细节（颜色、字体、间距）
- 和 `backend-rust/` 里 Auth0 集成（待确定哪个服务）对接 `POST /verify`
- i18n：生产至少有 en/zh-CN

### `unipass-cms-frontend-oss`（5 天）

- 枚举生产 CMS 的资源清单（需 screenshot 驱动）
- `ra-data-simple-rest` 改为实际 REST 适配器（可能是 `ra-data-nestjsx-crud` 或自定义）
- 鉴权：集成 `authProvider`（JWT）
- 权限模型：admin/operator/viewer 三层（推测）

### `unipass-payment-web-oss`（7 天）

- `@unipass/wallet-js` workspace link（待 `unipass-wallet-js-oss` 发布或 pnpm link）
- 解析 `pay=` 参数的二维码/deep-link 协议（从生产示例推断）
- 交易预览 UI（gas/recipient/amount）
- 签名反馈 + 链上状态轮询
- Error states（insufficient funds / user rejected / network）

### `unipass-wallet-frontend-oss`（14 天，最大）

视图清单（从生产 UI 类比推测）：
- Home / Unlock / Seed phrase / Setup email-2FA
- Assets: per-chain breakdown + NFT gallery
- Send: token picker, address book, gas estimation, review
- Receive: QR + address copy
- Session: dApp connections (WalletConnect-like)
- History: tx list with status + explorer links
- Settings: security / network / export

### `unipass-wallet-official-website-oss`（3 天）

- Brand asset 库（需从品牌方获取）
- 5-10 个静态 section（hero / features / security / community / contact）
- Docusaurus 集成或独立 Docs 链接
- SEO metadata + OG tags

## 与 Phase 7 的顺序

Phase 7 是 HueHub / Solagram / Bomb.fun 完全陌生产品的重写，比 Phase 6 更重。建议：先完成 Phase 6 的 5 个（UniPass 内部产品）验证流程，再启动 Phase 7。
