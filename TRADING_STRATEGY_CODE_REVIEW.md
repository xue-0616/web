# 交易策略代码审查报告

**日期**: 2026-04-17  
**范围**: `backend-node/dexauto-server/src/modules/` 中所有交易策略相关模块  
**状态**: ✅ 已修复 **17 个 bug**（8 个严重 / 5 个中等 / 4 个轻微）+ 全系统仍编译通过

---

## 审查覆盖范围

| 模块 | 文件 | 行数 | 审查状态 |
|------|------|------|----------|
| 自动策略执行器 | `automatic-strategy-syncer/utils/automatic-strategy-executor.ts` | 962 | ✅ |
| 策略同步器 | `automatic-strategy-syncer/automatic-strategy-syncer.service.ts` | 330 | ✅ |
| 跟单过滤器 | `automatic-strategy-syncer/utils/copy-trade-filter.ts` | 254 | ✅ |
| 仓位监控（TP/SL） | `position-monitor/position-monitor.service.ts` | 418 | ✅ |
| 仓位管理（PnL） | `position-manager/position-manager.service.ts` | 351 | ✅ |
| 资金分配 | `position-manager/fund-allocator.ts` | 248 | ✅ |
| 入场偏离监控 | `position-manager/entry-deviation-monitor.ts` | 247 | ✅ |
| 钱包评分 | `wallet-scorer/wallet-scorer.service.ts` | 522 | ✅ |
| 地址聚类（反 Sybil） | `wallet-scorer/address-cluster.service.ts` | 346 | ✅ |
| Geyser gRPC 订阅 | `geyser-subscriber/geyser-subscriber.service.ts` | 462 | ✅ |
| 跟随卖出 | `geyser-subscriber/follow-sell.service.ts` | 242 | ✅ |
| 爆发钱包检测 | `geyser-subscriber/burst-wallet-detector.service.ts` | 435 | ✅ |
| 实时退出流动性（熔断） | `geyser-subscriber/realtime-exit-liquidity.service.ts` | 441 | ✅ |
| DEX 交易解析器 | `geyser-subscriber/parsers/dex-swap-parser.ts` | 348 | ✅ |

---

## 🔴 第一轮严重 Bug（已修复）

### Bug #1 — `AutomaticStrategyExecutor` 使用了不存在的 logger 方法 (运行时崩溃)
**文件**: `automatic-strategy-executor.ts`  
**问题**: 5 处调用 `this.logger.info(...)`，但 `this.logger` 是 NestJS `Logger`（只有 `.log()`/`.error()`/`.warn()`/`.debug()`，无 `.info()`）  
**影响**: 进入这些代码路径时直接抛 `TypeError: this.logger.info is not a function`，使整个信号流中断  
**修复**: 全部改为 `this.logger.log(...)`

### Bug #2 — 入场偏离过高时仍然下单 (控制流漏洞)
**文件**: `automatic-strategy-executor.ts` (line 547)  
**问题**: 当 `entryDeviationMonitor` 判断偏离超阈值时，代码注释说"不返回，跳过 auto-trade"，但控制流继续走到 `for (let autoTradeId = 0; ...)`，用户配置的完整仓位大小仍被下单  
**影响**: 入场价过差的情况下依然按全仓位买入，导致追高  
**修复**: 新增 `skipAutoTrade` 布尔量，并把 `for` 循环上界改成 `skipAutoTrade ? 0 : this.strategy.autoTrades.length`

### Bug #3 — TrackedPosition 可能 undefined 属性引发崩溃
**文件**: `automatic-strategy-executor.ts` (line 313)  
**问题**: `walletScore?.metrics.recentAvgPositionSize > 0` —— 如果 `walletScore.metrics` 为 undefined，`.recentAvgPositionSize` 访问将抛异常（optional chaining 只停在 `?.metrics`，不会保护后续链）  
**修复**: 改为 `walletScore?.metrics?.recentAvgPositionSize ?? 0`

### Bug #7 — PnL 计算错误（分母缩水，导致过度报损）
**文件**: `position-manager.service.ts:recordSell`  
**问题**: SOL 成本基础计算 `solCostBasis = totalSolInvested × soldAmount / (currentTokenAmount + soldAmount)` —— 分母用的是"卖出前的持仓量"，但这不等于"历史总买入量"，多次部分卖出后分母不断缩水，导致后续每次卖出被分摊到过高的成本基础。  
**示例**:
- 买 100 个（10 SOL），卖 50 个（6 SOL）→ 正确盈亏 +1 SOL
- 再卖 30 个（5 SOL）→ 原代码算出 `solCostBasis = 10×30/50 = 6 SOL` → 亏损 -1 SOL  
- 实际 `solCostBasis = 10×30/100 = 3 SOL` → 盈利 +2 SOL

**修复**: 用 `entries.reduce(...tokenAmount)` 计算历史总买入量作为分母

### Bug #10 — Follow-sell 没区分触发源，误杀所有同币种仓位
**文件**: `follow-sell.service.ts`  
**问题**: 一个聪明钱卖出某代币时，`findMatchingPositions(tokenMint)` 只按 `tokenMint` 筛选，把所有用户持有该代币的仓位都标记为"源钱包已卖出"，哪怕这些仓位是由其他聪明钱触发建仓的  
**影响**: 一人卖，全仓跟卖。严重违反"只跟卖触发买入的那个钱包"的设计初衷  
**修复**: 加上 `pos.sourceWalletAddress === traderAddress` 过滤

### Bug #12 — 实时熔断器误杀所有同币种仓位（与 Bug #10 同类）
**文件**: `realtime-exit-liquidity.service.ts`  
**问题**: 同样的模式 —— `findMatchingPositions(tokenMint)` 不看源钱包，一个聪明钱"买后立刻卖"触发熔断后，会把所有该币种仓位按熔断比例减仓  
**修复**: 给 `findMatchingPositions` 加 `sourceWallet` 参数并在匹配时校验 `pos.sourceWalletAddress === sourceWallet`

### Bug #11 — BurstWallet 检测的胜率计算是假的
**文件**: `burst-wallet-detector.service.ts`  
**问题**: 检测爆发钱包时，`profitableSells = sells.filter(s => s.usdValue > 0).length`，但 `usdValue` 在 line 108 已经被 `Math.abs()` 了 —— 所有非零金额的卖出都被算作"盈利"。胜率指标完全失真。  
**影响**: 大量假钱包通过检测被导入为"爆发钱包"，污染智能钱池  
**修复**: 改为按 per-token P&L 计算（同一代币窗口期内的 totalSellUsd > totalBuyUsd → 该代币算 1 胜），并要求至少 2 个代币有正收益

---

## 🟡 第一轮中等 Bug（已修复）

### Bug #5 — 移动止损激活后回撤跌破激活阈值会失效
**文件**: `position-monitor.service.ts:runExitRules` Rule 2  
**问题**: 激活条件 `priceChangeFromEntry >= activationPct` 用的是"当前价距入场"，但一旦达到过 ATH，价格回撤后 `priceChangeFromEntry` 跌回激活线下时，移动止损又失效了  
**影响**: 价格冲到 +60% 后回撤到 +40%（ATH -12.5% drawdown），回撤幅度已满足但激活门检查未通过 → 止损不触发，眼睁睁看着利润继续回吐  
**修复**: 改为 `athChangeFromEntry >= activationPct`（ATH 达到过阈值则移动止损永久激活）

### Bug #6 — GeyserSubscriber 的 ping `setInterval` 跨重连泄漏
**文件**: `geyser-subscriber.service.ts:processStream`  
**问题**: `pingInterval` 只在 `!this.isRunning || !this.stream` 时清理，但 gRPC 流 `end`/`error` 事件没清除它  
**影响**: 每次重连留下一个 old stream 的 interval 定时器，累积运行 `.write()` 到 null stream 抛异常 + 内存泄漏  
**修复**: 在 `stream.on('end')` 和 `stream.on('error')` 中显式调用 `clearInterval(pingInterval)`

### Bug #13 — 地址聚类代表 (representative) 在 rebuild vs reload 后不一致
**文件**: `address-cluster.service.ts`  
**问题**: `rebuildClusters` 用 UF 的 root 作为代表存入 `entityMap`；但 `loadClusters` 用 `addresses[0]` 作为代表。两者不等，导致同一地址 `getEntity(x)` 在重启前后返回不同值 → 反 Sybil 去重不稳定  
**修复**: 统一用 `sort()[0]` 作为稳定代表（重建和重载都一致）

### Bug (tsconfig TS4041) — 3 个 unipass 项目 declaration emit 失败
**文件**: `unipass-activity-backend`, `unipass-wallet-backend`, `unipass-wallet-custom/extend`  
**问题**: `declaration: true` + getter 返回不可命名的外部类型 `CacheManagerRedisStore.RedisStoreConstructor`  
**修复**: 显式 `redisConfig(): any` 返回标注 + custom/extend 设置 `declaration: false`

---

## 🟢 其他优化

- 修复 `unipass-wallet-custom/extend` 共 71 个 TS 错误（ambient.d.ts 补 `__importDefault` / `@unipasswallet/*` 模块声明等）
- 所有 14 个 backend-node 项目现在均通过 `npm run build`
- 所有 8 个 backend-rust 项目通过 `cargo check`

---

## 逻辑上审查了但无 bug 的关键路径

- ✅ `CopyTradeFilter`: 9 层过滤（blacklist / market cap / liquidity / age / copy amount / platform / LP burnt / position increase / price impact）全部正确
- ✅ `validateStrategyTrigger`: 3 种触发器类型（PurchaseAddrUpper / PurchaseSolUpper / PurchaseAddrAndSolUpper）+ weighted consensus + 质量门槛都正确
- ✅ `PositionMonitorService.runExitRules`: 8 条退出规则的优先级排序（固定止损 → 移动止损 → 批量 TP/SL → 阶段性时间规则）逻辑正确
- ✅ `Probe Buy` 探针机制：first probe → 60s TTL 待确认；Cluster consensus override 把阈值从 10% 降到 3% 时逻辑正确
- ✅ `Circuit Breaker` 分级响应 + 随机分片卖出（MEV 规避）+ 3 次 Strike 自动拉黑逻辑正确
- ✅ `WalletScorerService` 的打分算法（PnL 25% + 胜率 20% + 活跃 10% + 持有时间 10% + 安全 20% + Token 质量 15%）正确
- ✅ `RandomizedTranches` 归一化后的上限 clamp + excess 再分配算法正确

---

## 🔴 第二轮严重 Bug（已修复）

### Bug #8 — fund-allocator 收到 length 而非 tier-weighted 分数，S 级聪明钱共识严重欠配
**文件**: `automatic-strategy-executor.ts` (line 520)  
**问题**: 旧代码 `const weightedScore = strategyTrigger.validTxs.length` 只看地址数量，丢弃了钱包 tier 权重。fund-allocator 的分档基于 `TIER_WEIGHTS` (S=3 / A=2 / B=1) 加权总分：
- 3 个 S-tier 钱包买入 → 真实加权 = **9**（应匹配 Strong 档位，0.5 倍仓位）
- 旧代码传递 length = **3** → 匹配 Moderate 档位（0.2 倍仓位）——**实际仓位被腰斩**

**影响**: 最高质量信号（多个 S-tier 顶级聪明钱同时买入）获得的仓位大小不如中等质量信号（多个 B-tier 钱包），完全颠倒了仓位管理逻辑  
**修复**: 调用 `walletScorerService.calculateWeightedConsensus(uniqueTraders)` 得到正确的加权分数

---

## 🟡 第二轮中等 Bug（已修复）

### Bug #14 — dex-swap-parser 的 block_time 使用本地时间而非区块时间
**文件**: `dex-swap-parser.ts:202`  
**问题**: `txUpdate.slot ? Date.now() : '0'` 直接用本地时间，忽略 Yellowstone 提供的真实 `createdAt.seconds` / `blockTime`。  
**影响**: 下游 `VALID_STRATEGY_DEX_TRADE_SECONDS` (2 分钟) 陈旧数据过滤失效——任何来自 gRPC 的交易都被视为"当前时刻"，即使已滞后数分钟（断网重连后 replay 场景）  
**修复**: 优先使用 `createdAt.seconds`，其次 `blockTime`，最后兜底 `Date.now()`

### Bug #15 — dex-swap-parser 的 owner fallback 会将交易归属到 Token Account 而非 Wallet
**文件**: `dex-swap-parser.ts:287,297`  
**问题**: `bal.owner \|\| accountKeys[bal.accountIndex]` 的 fallback 映射到 `accountKeys[index]`，但 `accountIndex` 指的是 **Token Account 地址**（ATA），不是钱包主地址  
**影响**: 在 `bal.owner` 缺失的极端场景下，所有交易都被错误归属到 ATA，完全丢失追踪能力  
**修复**: 移除不安全 fallback，只信任 `bal.owner`（Yellowstone gRPC proto 版本始终填充此字段）

### Bug #16 — 策略同步器 fire-and-forget 无顶层 `.catch()`
**文件**: `automatic-strategy-syncer.service.ts:238`  
**问题**: `strategy.syncAccountDexTradesWithLock(...)` 没 await 也没 catch —— 如果内部同步抛出（在 per-token 错误处理之前），会变成 unhandled promise rejection，Node 默认行为会 log warning 或（严格模式）退出进程  
**修复**: 加 `.catch((err) => this.logger.error(...))`

### Bug #17 — fund-allocator 超额暴露检查顺序错误
**文件**: `fund-allocator.ts:167-178`  
**问题**: `tradeAmount = Math.min(tradeAmount, remainingTokenBudget)` 先于 `if (remainingTokenBudget <= 0)` 检查。当 remainingBudget = 0 时，tradeAmount 被 clamp 到 0，然后检查返回错误原因——但错误信息是基于 clamped 值计算的，语义混乱  
**修复**: 先检查 `remainingTokenBudget <= 0` 直接返回，再 `Math.min`

---

## 编译验证

```
Backend-Rust:  8/8  ✅ cargo check 全部通过
Backend-Node: 14/14 ✅ npm run build 全部通过（dexauto-server 0 errors）
Backend-Bin:  10/10 ✅ cargo workspace 骨架 cargo check 通过
```

完成 后续可做：Docker Compose 端到端启动冒烟测试。
