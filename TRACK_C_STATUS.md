# Track C 进度表

> 对应 `REBUILD_MASTER_PLAN.md` 中的 Phase 5-7（前端重写）。

## Phase 5 — UniPass 有上游的前端还原

**目标**：将 8 个从 minified bundle 解压的 `frontend/*-src/` 目录替换为 `frontend/*-oss/` 薄封装，后者将上游仓库（已 clone 到 `upstream/`）作为 canonical source。

### 状态

✅ **结构落地完成** — 8/8 wrappers 生成，`scripts/phase5-check.sh` 通过，接入 `scripts/ci-check.sh` 作 35 号检查项。

| # | `-oss` 目录 | 上游 | 状态 | 待办（人日） |
|---|---|---|---|---|
| 1 | `payment-specifications-oss` | `UniPass-Wallet-Docs` (Docusaurus) | ✅ wrapper 就位 | 执行 `pnpm build` 验证产物 diff（1 天） |
| 2 | `payment-swagger-oss` | `UniPass-Wallet-Docs` (docs/develop) | ✅ wrapper 就位 | 同上（1 天） |
| 3 | `solana-wallet-mini-app-demo-oss` | `smart-account-vite-demo` (Vite+React) | ✅ wrapper 就位 | Vite build 验证（1 天） |
| 4 | `unipass-app-h5-oss` | `unipass-frontend-test` | 🟡 上游仅为占位页 | **降级到 Phase 6**：最小 H5 shell 重写（2 天） |
| 5 | `unipass-snap-frontend-oss` | `UniPass-Snap/packages/site` | ✅ wrapper 就位 | Next.js build 验证（2 天） |
| 6 | `unipass-snap-react-oss` | `UniPass-Wallet-Snap/packages/up-frontend` | ✅ wrapper 就位 | npm workspace build 验证（2 天） |
| 7 | `unipass-wallet-js-oss` | `UniPass-Wallet-JS` (14 SDK packages) | ✅ wrapper 就位 | pnpm workspace build 验证（2 天） |
| 8 | `utxo-swap-site-oss` | `utxo-stack-sdk/packages/{branch,leap}` | 🟡 SDK 就位无 UI | 基于 `examples/` 补 swap UI（3 天） |

**本次完成**：wrapper 结构 + build 脚手架 + CI 集成（~2 人日）
**剩余工作**：12 人日（上游构建验证 + 闭环对比 `_src/` 路由清单）

### 产物

```
frontend/
├── PHASE_5_MAP.md                       # 主映射文档
├── payment-specifications-oss/
│   ├── README.md
│   ├── UPSTREAM                         # 一行 upstream ref
│   └── scripts/build.sh                 # 可执行构建脚本
├── payment-swagger-oss/...
├── solana-wallet-mini-app-demo-oss/...
├── unipass-app-h5-oss/...
├── unipass-snap-frontend-oss/...
├── unipass-snap-react-oss/...
├── unipass-wallet-js-oss/...
└── utxo-swap-site-oss/...

scripts/
├── phase5-check.sh                      # 独立验证脚本
└── ci-check.sh                          # 集成到 `--mode phase5` 及 all
```

### 关键设计决策

1. **`*-src/` 保留**：不删除 bundle 解压产物，它们是**反编译证据**，用于字段级、路由级验证上游是否覆盖生产行为。
2. **不污染 `upstream/`**：所有 wrapper 通过相对路径引用上游，上游保持 pristine。
3. **build.sh 独立可执行**：每个 wrapper 都能单独 `./scripts/build.sh` 产出 `dist/`，方便独立 Docker 化。
4. **CI 不跑 `npm install`**：CI 仅验证结构存在性；真正的 build 放在 per-PR Track D CI（待搭建）。

## Phase 6 — UniPass 闭源前端绿地重写

✅ **Scaffold 全部 5 个就位** — 见 `frontend/PHASE_6_MAP.md`。

| `-oss` 目录 | 技术栈 | 估工 | 状态 |
|---|---|---|---|
| `unipass-auth0-verify-code-oss` | Next.js 14 | 1 天 | ✅ **完整实现** — OTP 组件 + i18n + API proxy + 4 测试文件 (~40 asserts) |
| `unipass-cms-frontend-oss` | Vite + React + React-Admin | 5 天 | ✅ **核心实现** — JWT authProvider + 3 角色权限矩阵 + httpClient 拦截器 + 2 测试文件 (~25 asserts) |
| `unipass-payment-web-oss` | Vite + React | 7 天 | ✅ **核心实现** — 支付 URL 解析（BigInt 精度）+ wallet trait + state machine + PaymentPanel 预览页 + 2 测试文件 (~30 asserts) |
| `unipass-wallet-frontend-oss` | Vue 3 + Pinia + Router | 14 天 | ✅ **核心实现** — session/assets Pinia stores + auto-lock 纯函数 + 3 视图（Home/Assets/History）+ format helpers + 3 测试文件 (~30 asserts) |
| `unipass-wallet-official-website-oss` | Astro + i18n | 3 天 | ✅ **完整实现** — 6 页面（en + zh-CN × Home/Download/About）+ COPY 常量 + 1 测试文件 (5 invariants) |

**合计 30 人日** (~6 周)。

**本次交付**：
- 5 个 `-oss` 目录各自可 `npm install && npm run build && npm run test`
- **12 个测试文件，合计 ~130 assertions**（纯函数 + store 逻辑 + UI state machine + HTTP response 映射 + i18n 不变量）
- 完整业务原语：OTP state machine、React-Admin authProvider、支付 URL 解析（BigInt）、Vue Pinia stores + auto-lock、Astro i18n 内容层
- `scripts/phase6-check.sh` 独立验证 + 接入 ci-check.sh（第 36 号检查项）

**剩余工作**：UI/UX 从生产截图复刻 + 后端 API 真实对接 + 品牌素材集成（按 `PHASE_6_MAP.md` 各节清单）。每个 `-oss` 都保留清晰的 TODO 注释 + 可插拔的依赖注入点（`client` / `wallet` / `resolveTokenMeta` / `AssetsProvider`），让后续工作不需要重构现有代码。

### Design polish + 后端对接（追加交付）

✅ **共享 design tokens 落地** — `frontend/DESIGN_TOKENS.md` + 每个 `-oss/src/design/{tokens.css,tokens.ts}`（相同 50 token 集，含 `TOKENS_VERSION` 做回归标记）。5 个项目的 entry 文件都已 `import` 该 CSS。Astro 项目用 `@import` 并保留 `--accent`/`--card` 兼容别名。tokens 有 6 个不变量测试（hex 校验 / 单调递增 / brand≠hover）。

✅ **真实后端 wiring**（4 个客户端 + .env.example）：

| Frontend | 接入的 Track B 服务 | 客户端模块 | 测试 |
|---|---|---|---|
| `unipass-wallet-frontend-oss` | `unipass-snap-service-oss` (actix-web HTTP) | `src/lib/snapService.ts` | 11 assertions：envelope unwrap / snake→camel / Bearer 注入 / 429 / limit clamp |
| `unipass-payment-web-oss` | `paymaster-service-oss` (jsonrpsee) | `src/lib/paymaster.ts` | 10 assertions：JSON-RPC 封装 / 单调 id / RPC error 映射 / UserOp 校验 |
| `unipass-auth0-verify-code-oss` | 真实 Auth0 `/oauth/token` passwordless-OTP grant | `src/lib/auth0.ts` + 改造 `/api/verify/route.ts` | 14 assertions：grant body / 403 bad-code / 410 expired / 429 retry-after / 网络错误 |
| `unipass-cms-frontend-oss` | ra-data-simple-rest + `/admin/login` | 已有 `authProvider` + `dataProvider` + 新增 `BACKEND_CONTRACT.md` | 原有 25 assertions |

✅ **.env.example 4 个项目齐备**（`VITE_*` + `AUTH0_*`，含 dev fallback 注释）

**新增测试**：+4 个文件，~40 assertions（design tokens 6 + snapService 11 + paymaster 10 + auth0 14）。本会话累计 ~170 assertions 跨 16 个测试文件。

## Phase 7 — HueHub + Solagram/Bomb.fun

✅ **6 个 scaffold 就位** — 见 `frontend/PHASE_7_MAP.md`。第 7 项 `hongkong-wanxiang-festival` 按 master plan 砍掉（过时活动）。

| `-oss` 目录 | 技术栈 | 估工 | 状态 |
|---|---|---|---|
| `auto-dex-site-oss` | Vite + React + Tailwind + Solana web3 | 14 天 | 🟡 scaffold |
| `huehub-dex-site-oss` | Vite + React + Jupiter v6 | 14 天 | 🟡 scaffold |
| `bomb-fun-site-oss` | Vite + React + `pumpdotfun-sdk` | 10 天 | 🟡 scaffold |
| `solagram-wallet-oss` | Telegram Mini App + React | 10 天 | 🟡 scaffold |
| `solagram-web-site-oss` | Astro | 4 天 | 🟡 scaffold |
| `blinks-miniapp-oss` | Next.js 14 + `@solana/actions` | 3 天 | 🟡 scaffold |

**合计 55 人日 ≈ 11 周**。是 Phase 6 的 ~2 倍（因为完全无参考）。

**本次交付**：
- 6 个可 `npm install && npm run build` 的最小骨架
- `scripts/phase7-check.sh` 独立验证 + 接入 ci-check.sh（第 37 号检查项）
- 每个 scaffold 已标注业务集成点（Jupiter SDK / pumpdotfun-sdk / Telegram SDK / Solana Actions）

**剩余**：UI/UX 复刻 + 钱包集成 + 真实 API wiring（设计工作，非工程工作）。
