# DexAuto 代码修改范围 — 完整分类清单

> Generated: 2026-04-15

---

## 1. dexauto-server (backend-node)

### 1.1 我们创建的全新模块/文件 (CREATED)

| 文件路径 | 说明 |
|----------|------|
| `modules/position-manager/position-manager.module.ts` | 仓位管理模块定义 |
| `modules/position-manager/position-manager.service.ts` | 仓位管理核心服务 (351行) — Redis 持仓跟踪、入场/出场记录、PnL 计算 |
| `modules/position-manager/fund-allocator.ts` | 资金分配服务 (248行) — 预算管理、单笔上限、共识权重分层配仓 |
| `modules/position-manager/entry-deviation-monitor.ts` | 入场偏差监控 (247行) — 跟踪我方报价与聪明钱均价的偏差 |
| `modules/position-manager/index.ts` | 模块桶导出 |
| `modules/wallet-scorer/kpi-dashboard.service.ts` | 系统KPI仪表板 (362行) — 信号→交易延迟、过滤率、rug pull 拦截率、胜率等 |
| `modules/wallet-scorer/address-cluster.service.ts` | 地址聚类服务 (346行) — Sybil 检测、关联地址识别 |
| `modules/wallet-scorer/ai-agent-detector.service.ts` | AI Agent 钱包检测器 (367行) — 区分人类聪明钱与AI机器人 |
| `modules/wallet-scorer/exit-liquidity-detector.ts` | 退出流动性检测器 (291行) — 识别做出口流动性的钱包 |
| `modules/wallet-scorer/wash-trade-detector.ts` | 洗盘检测器 (268行) — 虚假共识信号过滤 |
| `modules/wallet-scorer/wallet-scorer.service.ts` | 钱包评分服务 (522行) — 多维度评分、分层、降级回调(onDemotedCallbacks) |
| `modules/wallet-scorer/wallet-scorer.module.ts` | 钱包评分模块定义 |
| `modules/wallet-scorer/index.ts` | 模块桶导出 |
| `modules/smart-wallet-source/smart-wallet-source.service.ts` | 聪明钱来源管理核心服务 (329行) — 多源候选入库、评分筛选 |
| `modules/smart-wallet-source/smart-wallet-source.module.ts` | 聪明钱来源模块定义 |
| `modules/smart-wallet-source/external-wallet-import.service.ts` | 外部 API 导入服务 (219行) — GMGN/Birdeye/Cielo/ChainFM 批量导入 |
| `modules/smart-wallet-source/onchain-wallet-discovery.service.ts` | 链上发现服务 (299行) — ClickHouse 查询高胜率未知地址自动纳入 |
| `modules/smart-wallet-source/api-clients/gmgn.client.ts` | GMGN API 客户端 (207行) |
| `modules/smart-wallet-source/api-clients/birdeye.client.ts` | Birdeye API 客户端 (141行) |
| `modules/smart-wallet-source/api-clients/cielo.client.ts` | Cielo API 客户端 (131行) |
| `modules/smart-wallet-source/api-clients/chainfm.client.ts` | ChainFM API 客户端 (93行) |
| `modules/smart-wallet-source/index.ts` | 模块桶导出 |
| `modules/geyser-subscriber/geyser-subscriber.service.ts` | Yellowstone gRPC 实时数据服务 (461行) — 替换旧 WebSocket 数据源 |
| `modules/geyser-subscriber/geyser-subscriber.module.ts` | Geyser 订阅模块定义 |
| `modules/geyser-subscriber/follow-sell.service.ts` | 跟卖服务 (241行) — 监控聪明钱卖出后触发跟卖 |
| `modules/geyser-subscriber/burst-wallet-detector.service.ts` | 突发钱包检测器 (435行) — 实时发现高胜率未知地址 |
| `modules/geyser-subscriber/realtime-exit-liquidity.service.ts` | 实时退出流动性断路器 (441行) — 分层响应保护 |
| `modules/geyser-subscriber/shredstream-prefetch.service.ts` | ShredStream 预取服务 (405行) — pre-confirmation 信号 |
| `modules/geyser-subscriber/parsers/dex-swap-parser.ts` | DEX 交易解析器 (348行) — 从原始交易提取 swap 数据 |
| `modules/geyser-subscriber/index.ts` | 模块桶导出 |
| `modules/automatic-strategy/backtest/backtest.service.ts` | 回测服务 (382行) — ClickHouse 历史数据回测 |
| `modules/automatic-strategy/backtest/backtest.module.ts` | 回测模块定义 |
| `modules/automatic-strategy/strategy-config.service.ts` | 策略配置服务 (150行) — Redis 存储的用户可调参数 |
| `modules/automatic-strategy/automatic-strategy-dashboard.controller.ts` | 仪表板控制器 (222行) — KPI/资金/偏差/持仓/回测 REST API |
| `modules/position-monitor/position-monitor.service.ts` | 持仓监控服务 (418行) — 止损/止盈/追踪止损逻辑 |
| `modules/position-monitor/position-monitor.module.ts` | 持仓监控模块定义 |
| `modules/token-security/token-security.service.ts` | Token 安全检测服务 (762行) — RugCheck/Token-2022 Extension 检测 |
| `modules/token-security/token-security.module.ts` | Token 安全模块定义 |
| `modules/automatic-strategy-syncer/utils/copy-trade-filter.ts` | 复制交易过滤器 (254行) — 市值/流动性/代币年龄/黑名单过滤 |
| `migrations/1744600000000-DexTradesTTL.ts` | ClickHouse dex_trades TTL 迁移 |

### 1.2 我们修改的现有文件 (MODIFIED)

| 文件路径 | 修改内容 |
|----------|----------|
| `modules/automatic-strategy-syncer/utils/automatic-strategy-executor.ts` | **大幅修改 (961行)**：注入 KpiDashboardService、FundAllocatorService、EntryDeviationMonitorService、PositionManagerService；添加 per-token mutex、KPI 记录、资金分配判断、入场偏差检查 |
| `modules/automatic-strategy-syncer/automatic-strategy-syncer.service.ts` | **修改 (329行)**：注入 KpiDashboardService、FundAllocatorService、EntryDeviationMonitorService、PositionManagerService；向 executor 传递新服务；导入 SmartWalletSourceModule |
| `modules/automatic-strategy-syncer/automatic-strategy-syncer.module.ts` | **修改**：imports 新增 SmartWalletSourceModule、PositionManagerModule |
| `modules/automatic-strategy/automatic-strategy.module.ts` | **修改**：imports 新增 PositionManagerModule、BacktestModule；controllers 添加 DashboardController；providers 添加 StrategyConfigService |
| `app.module.ts` | **修改**：imports 新增 GeyserSubscriberModule、WalletScorerModule、PositionManagerModule、SmartWalletSourceModule（标注 "Phase 2-4: Smart Money Upgrade"）|
| `infrastructure/clickhouse/clickhouse.service.ts` | **可能修改**：包含 quote_amount 相关查询逻辑 |

### 1.3 原始/未修改的文件 (ORIGINAL)

| 模块/目录 | 文件 | 说明 |
|-----------|------|------|
| `modules/auth/` | auth.guard.ts, auth.module.ts, auth.service.ts, payload.ts | 认证模块 — 原始未动 |
| `modules/user/` | user.controller.ts, user.module.ts, user.service.ts + entities/ + dto/ + common/ | 用户模块 — 原始未动 |
| `modules/wallet/` | wallet.controller.ts, wallet.module.ts, wallet.service.ts + entities/ + dto/ + common/ | 钱包管理模块 — 原始未动 |
| `modules/token/` | token.controller.ts, token.module.ts, token.service.ts + entities/ + dto/ + query/ + constants/ | 代币模块 — 原始未动 |
| `modules/trading/` | trading.controller.ts, trading.module.ts, trading.service.ts + entities/ + dto/ | 交易模块 — 原始未动 |
| `modules/favorite/` | favorite.controller.ts, favorite.module.ts, favorite.service.ts + entities/ + dto/ | 收藏模块 — 原始未动 |
| `modules/message-notifier/` | message-notifier.controller.ts, .module.ts, .service.ts + entities/ + dto/ | 通知模块 — 原始未动 |
| `modules/transfer-subscriber/` | transfer-subscriber.module.ts, transfer-subscriber.service.ts | 转账订阅模块 — 原始未动 |
| `modules/transfer-syncer/` | transfer-syncer.module.ts, transfer-syncer.service.ts | 转账同步模块 — 原始未动 |
| `modules/stream/` | stream.gateway.ts, stream.module.ts, stream.service.ts + interfaces/ | WebSocket 流模块 — 原始未动 |
| `modules/kms/` | kms.module.ts, kms.service.ts | KMS 密钥管理 — 原始未动 |
| `modules/redis/` | redis.module.ts | Redis 模块 — 原始未动 |
| `modules/automatic-strategy/` | automatic-strategy.controller.ts, automatic-strategy.service.ts + entities/ + dto/ | 自动策略核心（控制器/服务/实体）— 原始未动 |
| `modules/automatic-strategy-syncer/utils/` | chainFMClient.ts | ChainFM 客户端工具 — 原始未动 |
| `config/` | configuration.ts, database.config.ts, redis.config.ts, clickhouse.config.ts | 配置文件 — 原始未动 |
| `common/` | utils.ts, tradingClient.ts, pendingOrder.ts, genericAddress.ts, etc. | 通用工具 — 原始未动 |
| `migrations/` | 全部 1730*-1739* 迁移文件 | 数据库迁移 — 原始未动 |
| 根目录 | app.controller.ts, app.service.ts, error.ts, main.ts | 应用根文件 — 原始未动 |

---

## 2. dexauto-trading-server (backend-rust)

### 2.1 我们创建的全新文件 (CREATED)

| 文件路径 | 说明 |
|----------|------|
| `crates/utils/src/shredstream_client.rs` | ShredStream gRPC 客户端 (236行) — pre-confirmation swap 数据 |
| `crates/utils/src/fee_estimator.rs` | 动态手续费估算器 (194行) — Helius Priority Fee + Jito Tip |
| `crates/utils/src/next_block_client.rs` | NextBlock MEV 保护客户端 (50行) |

### 2.2 我们修改的现有文件 (MODIFIED)

| 文件路径 | 修改内容 |
|----------|----------|
| `crates/tx-builder/src/jupiter/swap.rs` | 添加 `check_entry_deviation()` 函数 (行175-211) — 入场偏差检查 |
| `crates/utils/src/lib.rs` | 添加 `pub mod fee_estimator;` 和 `pub mod shredstream_client;` |
| `crates/utils/src/tx_submitter/submitter.rs` | 添加 Staked RPC SWQoS 回退路径 — `with_staked_rpc()`, 高信号TX通过 staked RPC 提交 |
| `src/config.rs` | 添加 `shredstream_endpoint` 和 `staked_rpc_url` 配置字段 |
| `src/main.rs` | 添加 staked RPC 配置初始化逻辑 |

### 2.3 原始/未修改的文件 (ORIGINAL)

| 路径 | 说明 |
|------|------|
| `crates/api/` | 全部 API 路由处理 (swap, cancel_tx, op_key, status) — 原始未动 |
| `crates/api-common/` | API 公共上下文 — 原始未动 |
| `crates/cpis/` | CPI 调用 — 原始未动 |
| `crates/entity/` | 实体定义 (operator_keys, trading_transactions, trigger_transactions) — 原始未动 |
| `crates/tx-builder/src/raydium_amm/` | Raydium AMM 交易构建 — 原始未动 |
| `crates/tx-builder/src/lib.rs`, `utils.rs` | 交易构建公共代码 — 原始未动 |
| `crates/utils/src/data_center_client.rs` | 数据中心客户端 — 原始未动 |
| `crates/utils/src/jito_client.rs` | Jito 客户端 — 原始未动 |
| `crates/utils/src/op_key_manager.rs` | 操作密钥管理 — 原始未动 |
| `crates/utils/src/tx_submitter/pending_transaction.rs` | 待处理交易 — 原始未动 |
| `crates/utils/src/tx_submitter/runner.rs` | 提交器 runner — 原始未动 |
| `crates/utils/src/tx_submitter/mod.rs` | 提交器模块定义 — 原始未动 |

---

## 3. auto-dex-site-src (frontend)

**状态：完全由我们创建 (ENTIRELY CREATED)**

该前端项目由我们从零重建（原始编译产物 `auto-dex-site` 只有 dist 目录无源码），全部 30 个源文件均为新创建：

| 目录 | 文件 |
|------|------|
| `src/` | App.tsx, main.tsx, vite-env.d.ts |
| `src/pages/` | Account.tsx, Agent.tsx, Download.tsx, Hot.tsx, Security.tsx, Setting.tsx, TasksCreate.tsx, TasksDetail.tsx, TasksList.tsx, TokenEth.tsx, TokenSolana.tsx, TokenSolanaMarket.tsx |
| `src/components/` | AuthGuard.tsx, LoadingSpinner.tsx, WalletProvider.tsx |
| `src/components/Layout/` | MainLayout.tsx, Navbar.tsx |
| `src/components/Trading/` | TradingPanel.tsx, TradeHistory.tsx |
| `src/hooks/` | useAuth.ts, useNotification.ts, useSolPrice.ts, useTheme.tsx |
| `src/services/` | api.ts, firebase.ts, solana.ts |
| `src/stores/` | atoms.ts |
| `src/i18n/` | index.ts |
| 根目录 | package.json, vite.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js, index.html |

---

## 4. 项目根目录文档与工具 (CREATED)

| 文件 | 说明 |
|------|------|
| `SMART_MONEY_UPGRADE_PLAN.md` | 聪明钱升级完整方案 (56KB) |
| `REBUILD_PLAN.md` | 系统重建计划 |
| `SYSTEM_ANALYSIS.md` | 系统分析文档 |
| `TRADING_LOGIC_REVIEW.md` | 交易逻辑审核 |
| `AUDIT_STATUS.md` | 审计状态 |
| `MISSING_COMPONENTS_SOLUTION.md` | 缺失组件解决方案 |
| `docs/FEATURE_INVENTORY.md` | 功能清单 |
| `docs/TRADING_STRATEGY.md` | 交易策略文档 |
| `tools/decompile-nestjs.py` | NestJS dist 反编译工具 |
| `tools/fix-restored-ts.py` | 恢复代码修复工具 v1 |
| `tools/fix-restored-ts-v2.py` | 恢复代码修复工具 v2 |

---

## 统计摘要

| 子项目 | 创建文件数 | 修改文件数 | 原始文件数 | 总文件数 |
|--------|-----------|-----------|-----------|---------|
| dexauto-server (Node.ts) | ~39 | ~6 | ~65 | ~110 |
| dexauto-trading-server (Rust) | 3 | 5 | ~25 | ~33 |
| auto-dex-site-src (Frontend) | ~30 (全部) | 0 | 0 | ~30 |
| 根目录文档/工具 | ~11 | 0 | 1 (README) | ~12 |
| **合计** | **~83** | **~11** | **~91** | **~185** |
