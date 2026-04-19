# Solana DEX 聪明钱跟单交易系统 — 完整技术文档

> 最后更新: 2026-04-15  
> 代码库: `backend-node/dexauto-server` (NestJS) + `backend-rust/dexauto-trading-server` (Actix-Web)

---

## 目录

1. [系统总览](#1-系统总览)
2. [第一层：聪明钱包发现与评分](#2-第一层聪明钱包发现与评分)
3. [第二层：实时信号捕获](#3-第二层实时信号捕获)
4. [第三层：信号累积与共识触发](#4-第三层信号累积与共识触发)
5. [第四层：多道过滤管线](#5-第四层多道过滤管线)
6. [第五层：资金分配与入场偏差检测](#6-第五层资金分配与入场偏差检测)
7. [第六层：Jito Bundle 原子化交易提交](#7-第六层jito-bundle-原子化交易提交)
8. [第七层：持仓监控与退出规则](#8-第七层持仓监控与退出规则)
9. [第八层：反博弈与安全机制](#9-第八层反博弈与安全机制)
10. [第九层：监控、回测与配置](#10-第九层监控回测与配置)
11. [服务索引](#11-服务索引)
12. [部署依赖](#12-部署依赖)

---

## 1. 系统总览

### 1.1 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Discovery Layer (定时任务)                       │
│  GMGN / Birdeye / Cielo / ChainFM → SmartWalletSourceService       │
│  BurstWalletDetectorService (实时发现) → WalletScorerService (评分)  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ S/A/B 级钱包地址
┌──────────────────────────▼──────────────────────────────────────────┐
│                     Signal Layer (实时数据流)                        │
│  ShredStream gRPC (预确认, -200~500ms) ──┐                          │
│  Yellowstone gRPC (确认后) ──────────────┤→ 去重后注入策略引擎       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ ParsedDexSwap 买入/卖出信号
┌──────────────────────────▼──────────────────────────────────────────┐
│                     Strategy Layer (策略评估引擎)                     │
│  Redis ZSet 累积 → 共识触发 → CopyTradeFilter                       │
│  → TokenSecurityService → 入场偏差 → 资金分配 → 下单                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ TradingOrder
┌──────────────────────────▼──────────────────────────────────────────┐
│                     Execution Layer (Rust 端)                        │
│  Jupiter V2 构建 → Jito Bundle [Swap + Tip] 原子提交                 │
│  → Bundle 落地确认 → Staked RPC (SWQoS) → Standard RPC fallback     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ 持仓追踪
┌──────────────────────────▼──────────────────────────────────────────┐
│                     Exit Layer (退出与保护)                           │
│  PositionMonitorService (批量 TP/SL)                                 │
│  FollowSellService (跟卖)                                            │
│  RealtimeExitLiquidityService (Circuit Breaker 熔断)                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 端到端时序（典型场景：3 钱包共识买入）

```
t=0ms       ShredStream 捕获 Wallet_A 买入 TOKEN_X (预确认)
            → 价格/代币信息预热缓存
            → 注入 syncAccountDexTrades()
            → Redis ZSet: TOKEN_X = [Wallet_A]

t=200ms     ShredStream 捕获 Wallet_B 买入 TOKEN_X
            → Redis ZSet: TOKEN_X = [Wallet_A, Wallet_B]

t=500ms     Yellowstone gRPC 确认 Wallet_A 的 tx
            → wasPreConfirmed() = true → 跳过（已处理）

t=800ms     ShredStream 捕获 Wallet_C 买入 TOKEN_X
            → Redis ZSet: TOKEN_X = [A, B, C]
            → 触发共识: 3 地址 ≥ upperAddressesCount
            → CopyTradeFilter: 市值/流动性/代币年龄 ✓
            → TokenSecurityService: Mint/Freeze/Token2022/RugCheck ✓
            → 入场偏差: SM 均价 vs 当前池价 < 15% ✓
            → 资金分配: 6 票 → 50% 预算 = 5 SOL → min(5, 用户配置)

t=900ms     Node.js 提交 TradingOrder → Rust trading-server

t=950ms     Jupiter V2 Quote + Swap TX 构建
            → Jito tip_floor API → P50 = 0.003 SOL
            → 构建 tip 交易 (SOL Transfer → 随机 tip account)
            → Bundle = [Swap TX, Tip TX]
            → Jito Block Engine sendBundle

t=1200ms    Jito getBundleStatuses → "confirmed" at slot 289xxxx
            → 交易完成

t=1300ms    PositionManagerService.recordBuy()
            → PositionMonitorService 开始追踪持仓

t+5min      Circuit Breaker: Wallet_A 在 2 分钟内卖出
            → Level 1 触发 → 卖出 80%（分 2-4 笔随机 tranche）
            → Strike +1 → 达到 3 次 → Wallet_A 降级至 C 级
            → onDemotedCallbacks 立即触发 → 从监控列表移除
```

---

## 2. 第一层：聪明钱包发现与评分

### 2.1 多源发现管线

**SmartWalletSourceService** (`smart-wallet-source/smart-wallet-source.service.ts`)

| 数据源 | 频率 | 采集内容 |
|--------|------|----------|
| GMGN | 每 6h | Top traders by PnL, win rate |
| Birdeye | 每 6h | Top traders by volume, profitability |
| Cielo | 每 6h | Whale wallet activity |
| ChainFM | 策略配置 | 频道地址订阅 (addressSubs) |
| BurstWalletDetector | 实时 | 未知地址突然盈利发现 |

**候选人生命周期:**
- 首次发现 → `watch` 状态
- 2+ 次独立导入周期发现 → `active` 状态（`MIN_IMPORT_CYCLES_FOR_ACTIVE = 2`）
- Redis TTL: 45 天

### 2.2 Burst 实时发现

**BurstWalletDetectorService** (`geyser-subscriber/burst-wallet-detector.service.ts`)

监听所有交易中的签名者（包括未监控地址），当某未知地址在 30 分钟窗口内满足条件时自动导入:

| 条件 | 阈值 |
|------|------|
| 最少交易数 | 5 笔 |
| 最低净利润 | $2,000 |
| 最低胜率 | 60% |
| 最少代币种类 | 2 种（防单币 wash） |
| 最少卖出交易 | 2 笔 |

**Sybil 防御:** 追踪资金来源地址 → 同一父钱包 1h 内产出 3+ burst 地址 → 整个 cluster 封禁。

### 2.3 钱包评分

**WalletScorerService** (`wallet-scorer/wallet-scorer.service.ts`)

**评分维度（compositeScore 0-100）:**
- 30 天 PnL
- 30 天胜率
- 平均持仓时间
- 30 天交易笔数
- 平均仓位大小
- 最大回撤
- Rug Pull 参与次数（负权重）
- Bundle 交易次数（负权重，潜在 dev）
- 不安全代币交易比例（负权重）

**分级:**

| 等级 | 分数范围 | 共识权重 | 描述 |
|------|----------|----------|------|
| S | 85+ | ×3 | 顶级交易者 |
| A | 70-84 | ×2 | 优质交易者 |
| B | 50-69 | ×1 | 一般交易者 |
| C | <50 | ×0 | 低质量/淘汰 |

**交易风格子分类:**

| 风格 | 平均持仓时间 | 用途 |
|------|-------------|------|
| sniper | <5 分钟 | Circuit Breaker 跳过 Level 3 |
| narrative | 5 分钟~6 小时 | 完整 Circuit Breaker 响应 |
| diamond | >6 小时 | 任何快速卖出都高度异常 |

**降级与淘汰:**
- 评分 < 30 → 降级
- 评分 < 20 连续 7 天 → 淘汰
- C 级 → `onDemotedCallbacks` 立即触发，从监控列表实时移除（零延迟）

### 2.4 Sybil 集群检测

**AddressClusterService** (`wallet-scorer/address-cluster.service.ts`)

- 追踪地址的初始 SOL 资金来源（创建时的第一笔 SOL 转入）
- 共享相同资金来源的地址归为同一 "实体"
- 共识计票时，同一实体的多个地址只算 1 票
- `countUniqueEntities(addresses)` — 去重后返回独立实体数

---

## 3. 第二层：实时信号捕获

### 3.1 双通道架构

**通道 1: ShredStream 预确认（激进模式）**

文件: `geyser-subscriber/shredstream-prefetch.service.ts`

```
jito-shredstream-proxy (本地 sidecar, :9999)
  → gRPC SubscribeEntries
  → 解析原始 shred entry 字节
  → 匹配: DEX 程序 ID + 监控钱包地址
  → 生成 ParsedDexSwap { trader, base_mint, side, usd_value, tx_id }
  → 价格/代币信息预热缓存
  → 直接注入 syncAccountDexTrades() → 触发累积/过滤/下单
```

**支持的 DEX 程序:**
- Raydium V4 / CLMM / CPAMM
- Jupiter V6
- PumpFun
- Orca (Whirlpool)
- Meteora

**价格富化（0ms 主路径）:**
- 主路径: `quote_amount`（SOL lamports）× SOL 价格 = 即时计算
- SOL: `lamports / 1e9 × SOL_USD`
- USDC/USDT: `amount / 1e6`
- 回退路径: ClickHouse 查询 token 价格（仅当 quote_amount 不可用时）

**通道 2: Yellowstone gRPC 确认后**

文件: `geyser-subscriber/geyser-subscriber.service.ts`

```
Yellowstone gRPC (Helius / QuickNode)
  → SubscribeUpdate (CONFIRMED commitment)
  → parseTransaction() 提取 DEX swaps
  → 去重: wasPreConfirmed(tx_id) → 已预处理的买入信号跳过
  → 未预处理的信号正常进入策略流程
  → 卖出信号始终处理（FollowSell + Circuit Breaker 需要精确数据）
```

### 3.2 去重机制

```
ShredStream tx_id → recentShredTxIds Map (120s TTL, 自动清理)
gRPC 确认路径 → wasPreConfirmed(tx_id)
  ├─ true → 跳过买入信号（避免重复触发）
  └─ false → 正常处理（ShredStream 漏掉的交易）
```

### 3.3 信号路由

| 信号类型 | ShredStream | Yellowstone gRPC |
|----------|-------------|------------------|
| 买入 | ✓ 直接触发策略 | 去重后补漏 |
| 卖出 | ✗ 不处理 | ✓ FollowSell + Circuit Breaker |
| Burst 检测 | ✗ | ✓ 所有签名者 swaps |

---

## 4. 第三层：信号累积与共识触发

### 4.1 信号累积

**AutomaticStrategyExecutor** (`automatic-strategy-syncer/utils/automatic-strategy-executor.ts`)

每笔聪明钱买入信号:
1. 验证 `block_time` 在 `VALID_STRATEGY_DEX_TRADE_SECONDS`（120s）窗口内
2. 查找对应的 `monitorAddress`
3. 按 `base_mint` 分组（不同代币并行处理，同代币串行）
4. 存入 Redis ZSet（key = `策略ID:TOKEN:代币地址`, score = 时间戳）
5. 同时存入 Redis String（key = `TX:tx_id`, value = 完整交易数据）

### 4.2 Per-Token 并行 Mutex

```typescript
// 按 base_mint 分组 → 不同代币 Promise.all 并行
// 同一代币 → tokenMutex.runExclusive() 串行（Redis ZSet 排序需要）
tokenLocks: Map<string, Mutex>  // 自动清理: >200 时裁剪到 150
```

### 4.3 共识触发类型

**`validateStrategyTrigger()`** 支持 3 种触发条件:

| 类型 | 说明 | 示例 |
|------|------|------|
| `PurchaseAddrUpper` | N 个不同地址买入 | 3 个钱包都买了同一代币 |
| `PurchaseSolUpper` | 总买入 SOL 量 ≥ N | 所有钱包合计买入 ≥ 10 SOL |
| `PurchaseAddrAndSolUpper` | N 个地址且每个 ≥ M SOL | 3 个钱包各买 ≥ 2 SOL |

### 4.4 加权共识门控

触发条件满足后，还需通过质量检查:

```typescript
// 最低质量要求（二选一）:
meetsMinimumQuality(traderAddrs):
  - 至少 1 个 S 级钱包
  - 或至少 3 个 A 级钱包

// 加权共识计算:
calculateWeightedConsensus(traderAddrs):
  S 级 × 3 + A 级 × 2 + B 级 × 1 + C 级 × 0
```

---

## 5. 第四层：多道过滤管线

### 5.1 CopyTradeFilter（第 1 道）

文件: `automatic-strategy-syncer/utils/copy-trade-filter.ts`

| 过滤条件 | 默认值 | 说明 |
|----------|--------|------|
| 市值 (USD) | 无限制 | min/max |
| 流动性 (USD) | min: $10,000 | 池子太小不安全 |
| 代币年龄 (秒) | min: 60s | 排除刚创建的代币 |
| 每地址买入量 (SOL) | 0.1 ~ 50 | 异常金额过滤 |
| 平台限制 | 无 | pump.fun / raydium / orca 等 |
| LP 燃烧率 | 无 | 0-1 |
| 最大加仓次数 | 3 | 同一代币最多买 3 次 |
| 黑名单 | 空 | 代币 mint 地址 |
| 最大价格影响/SOL | 5% | 防 LPI 操纵（1 SOL 导致 >5% 价格变化 → 拒绝）|

### 5.2 Probe Buy 检测（第 2 道）

检测异常小额买入（可能是试探/占位）:

```
当前买入 < 钱包平均仓位 × effectiveThreshold → 标记为 probe
  └─ effectiveThreshold 默认 10%
  └─ 群体共识覆盖:
     ├─ 2+ 独立实体（Sybil 去重后）也在买 → 阈值降至 3%
     └─ 1 个独立实体也在买 → 阈值降至 6%

Probe 处理流程:
  首次 → Redis 缓存（60s TTL），进入 ZSet 但不触发
  60s 内追加买入 → probe 确认 → 合并后正常评估
  60s 超时 → 自然过期
```

### 5.3 TokenSecurityService（第 3 道）

文件: `token-security/token-security.service.ts`

**Layer 1: Mint/Freeze Authority (~50ms)**
- Mint Authority 仍存在 → 风险加分
- Freeze Authority 仍存在 → 高风险

**Layer 1.5: Token-2022 扩展检查 (~50ms)**

| 扩展 | 处理 |
|------|------|
| PermanentDelegate | 始终阻断（可任意转走代币）|
| NonTransferable | 始终阻断（无法卖出）|
| ConfidentialTransfer | 始终阻断（无法验证余额）|
| TransferHook | 检查 hook 程序是否在白名单 |
| TransferFee | 费率 > 5% 警告, > 20% 阻断 |

**TransferHook 白名单:**
- LibrePlex 版税: `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d`
- Metaplex Auth Rules: `auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg`
- WEN 分红: `WNSrqdFKMnRPpvNz3thNMmLNPEf5r2WFGHN29rXCbcQ`

**Layer 2: RugCheck API (~200ms)**
- Trust Score (0-100)
- Risk Level 评估

**Layer 3: 链上数据 (~100ms)**
- 流动性深度
- 前 10 持有者集中度
- LP 燃烧比例
- 开发者持仓比例

**Layer 4: CU 模拟预估（仅 Token-2022 + TransferHook）(~100ms)**
- 即使 Hook 通过了白名单 + PDA + ExtraAccountMeta 验证，仍可能包含高算力逻辑
- 构建最小 transferChecked 指令 → `simulateTransaction` → 读取 `unitsConsumed`
- `> 800,000 CU` → CRITICAL 阻断（正常 swap ~150k-300k CU）
- `> 400,000 CU` → 警告日志
- 双层防御: Rust 端提交前也执行 `simulateTransaction`，CU > 1,000,000 → 拒绝发送（保护 Jito tip 不被浪费）

**安全策略: Fail-Safe — 安全检查本身报错时，拒绝该代币**

---

## 6. 第五层：资金分配与入场偏差检测

### 6.1 入场偏差检测

**EntryDeviationMonitorService** (`position-manager/entry-deviation-monitor.ts`)

```
智能钱包加权平均入场价 = Σ(usd_value) / Σ(base_amount)
    （从触发交易的 validTxs 中计算）

偏差 = (我们的报价 - SM 均价) / SM 均价

决策:
  偏差 > 15% → 拒绝交易（价格已跑太远）
  偏差 5-15% → 减少仓位
  偏差 < 5%  → 正常执行
```

### 6.2 资金分配

**FundAllocatorService** (`position-manager/fund-allocator.ts`)

| 共识权重 | 预算比例 | 说明 |
|----------|----------|------|
| ≥ 10 | 100% | 强共识（多个 S 级） |
| 6-9 | 50% | 中等共识 |
| 4-5 | 20% | 弱共识 |
| 2-3 | 10% | 最低共识 |

**约束:**
- 总预算上限: 10 SOL
- 最大并发持仓: 15 个
- 单代币最大敞口: 20%
- 最终金额: `min(分配金额, 用户配置金额)`

---

## 7. 第六层：Jito Bundle 原子化交易提交

### 7.1 交易构建 (Rust 端)

**Jupiter V2 API** (`tx-builder/src/jupiter/swap.rs`)

```
1. GET /quote → 获取最优路由报价
   - dynamicSlippage: Jupiter 自动优化滑点
   - restrictIntermediateTokens: 限制中间代币（安全）
   - 监控 priceImpactPct > 5% → 警告日志

2. POST /swap → 构建签名交易
   - dynamicComputeUnitLimit: Jupiter 计算最优 CU
   - dynamicSlippage: true
   - prioritizationFeeLamports: context-aware 优先费
```

### 7.2 Bundle 原子提交

**TxSubmitter** (`utils/src/tx_submitter/submitter.rs`)

```
submit_full(tx_bytes, is_anti_mev, bribery_amount, signal_strength)
│
├─ 1. 确定 Tip 金额
│    ├─ bribery_amount > 0 → 使用用户指定金额
│    └─ bribery_amount = 0 → 查询 Jito tip_floor API
│         ├─ High signal (≥10 票) → P75
│         ├─ Normal signal (4-9 票) → P50
│         └─ Low signal (<4 票) → P50
│    Floor: 10,000 lamports | Ceiling: 10,000,000 lamports (0.01 SOL)
│
├─ 2. 构建 Tip 交易
│    ├─ SystemProgram::Transfer
│    ├─ From: fee_payer (tx_submitter_private_key)
│    ├─ To: 8 个 Jito tip 账户随机选择
│    └─ Blockhash: getLatestBlockhash(finalized)
│
├─ 2.5 Pre-flight CU 检查
│    simulateTransaction(swap_tx) → unitsConsumed
│    > 1,000,000 CU → 拒绝（不浪费 tip）
│    ComputationalBudgetExceeded → 拒绝
│
├─ 3. 打包 Bundle
│    Bundle = [Swap TX, Tip TX]  (最多 5 笔，原子执行)
│    ├─ Swap 失败 → Tip 不支付（原子性保证）
│    └─ Jito Block Engine: POST /api/v1/bundles
│
├─ 4. 落地确认轮询
│    getBundleStatuses → 每 500ms 轮询，最多 15s
│    ├─ "confirmed" / "finalized" → 返回 slot
│    ├─ "failed" → 返回失败
│    └─ 超时 → 降级到 RPC
│
├─ 5. 降级路由
│    Jito 失败 + High signal → Staked RPC (SWQoS 优先调度)
│    Jito 失败 + Normal/Low → Standard RPC
│    Staked RPC 失败 → Standard RPC
│
└─ 6. Anti-MEV 严格模式
     is_anti_mev = true + Jito 失败 → 直接报错，不降级
```

**Jito Block Engine 区域端点:**
- NY / SLC / Amsterdam / Frankfurt / Tokyo

**Tip 账户轮换:** 8 个官方 Jito tip 账户，随机选择（减少争用）

### 7.3 后台 Worker

**main.rs:**
```
mpsc channel (buffer=256)
  → tokio::spawn worker loop
  → 每个 SwapJob 携带: tx_bytes, is_anti_mev, bribery_amount, consensus_votes
  → SignalStrength::from_consensus_votes()
  → submit_full()
```

---

## 8. 第七层：持仓监控与退出规则

### 8.1 PositionMonitorService

文件: `position-monitor/position-monitor.service.ts`

**追踪状态 (Redis):**
- `entryPriceUsd`, `currentPriceUsd`, `athPriceUsd`
- `entryTimeMs`, `athTimeMs`
- `remainingRatio` (1.0 = 满仓, 部分卖出后递减)
- `sourceWalletAddress`, `sourceWalletSellRatio`

**退出规则（按优先级）:**

| 规则 | 触发条件 | 卖出比例 |
|------|----------|----------|
| R1: 时间止损 | 入场 N 秒后未涨 5% | 卖出 50% |
| R2: 固定止损 | 跌破入场价 30% | 卖出 100% |
| R3: 批量 TP/SL | 用户自定义多规则 | 按规则 |
| R4: ATH 回撤 | 从最高点回撤 X% | 按幅度 |
| R5: 跟卖 | 源钱包卖出 ≥50% | 卖出 70% |

**批量 TP/SL 示例:**
```
Rule 1: takeProfit  +50%  → sell 30% (回本)
Rule 2: takeProfit +200%  → sell 30% (锁利)
Rule 3: takeProfit +500%  → sell 30% (大赢)
Rule 4: stopLoss   -30%   → sell 100% (止损)
```

### 8.2 FollowSellService（跟卖）

文件: `geyser-subscriber/follow-sell.service.ts`

```
检测: gRPC 卖出信号来自我们的源钱包
  → 计算: 卖出比例 = sellAmount / estimatedHolding
  → 更新: trackedPosition.sourceWalletSellRatio
  → PositionMonitorService 下次评估时触发 Rule 5
  → 持仓追踪 Redis (7 天 TTL)
```

### 8.3 RealtimeExitLiquidityService（Circuit Breaker 熔断）

文件: `geyser-subscriber/realtime-exit-liquidity.service.ts`

**分级响应:**

| 级别 | 买入后时间 | 卖出比例 | 风险判定 |
|------|-----------|----------|----------|
| L1 | < 2 分钟 | 80% | 几乎确定在割韭菜 |
| L2 | 2-5 分钟 | 50% | 很可能在割韭菜 |
| L3 | 5-10 分钟 | 30% | 可疑，减少敞口 |

**交易风格感知:**
- sniper 钱包: 跳过 L3（快速退出是其正常行为）
- narrative 钱包: 完整分级响应
- diamond 钱包: 10 分钟内卖出极其异常 → 始终触发

**Tranche 随机化（防 MEV 指纹）:**
```
大额卖出 → 分成 2-4 笔 tranche
每笔间隔: 500ms ~ 2000ms (随机)
每笔比例: ±30% 抖动
单笔上限: 35% 总仓位
```

**Strike 机制:**
- 每次 Circuit Breaker 触发 → wallet strike +1
- 24 小时内 3 次 → 自动降级
- `onDemotedCallbacks` → 即时从监控列表移除（零延迟）

**实时告警:**
- Circuit Breaker 触发时 → Firebase 推送通知（L1/L2/L3 级别）

---

## 9. 第八层：反博弈与安全机制

### 9.1 Sybil / Cabal 防御

| 机制 | 实现 |
|------|------|
| 资金来源聚类 | AddressClusterService: 共享父钱包 → 同一实体 |
| 共识去重 | countUniqueEntities(): 同 cluster 多地址只算 1 票 |
| Burst Sybil | 同一资金来源 1h 产出 3+ burst 地址 → 全部封禁 |
| Probe 群体覆盖 | 2+ 独立实体也在买 → 降低 probe 阈值（不是 Sybil 伪造）|

### 9.2 LPI（流动性池注入）操纵防御

- `maxPriceImpactPerSol`: 1 SOL 买入 > 5% 价格变动 → 池子太薄 → 拒绝
- `estimatedPriceImpact`: tradeAmount / poolQuoteLiquidity（常数乘积 AMM 近似）

### 9.3 Token 安全层

详见 [第四层 5.3 节](#53-tokensecurityservice第-3-道)

### 9.4 MEV 保护

- 所有交易默认通过 Jito Bundle 提交
- Swap + Tip 原子打包（Swap 失败 → Tip 不支付）
- `is_anti_mev = true` 时，Jito 失败直接报错，不降级到公共 RPC
- Jupiter V2 `dynamicSlippage` 自动优化（减少滑点被夹几率）
- Circuit Breaker 卖出使用 tranche 随机化（防止 MEV bot 预判后续 tranche）

---

## 10. 第九层：监控、回测与配置

### 10.1 KPI Dashboard

**KpiDashboardService** (`wallet-scorer/kpi-dashboard.service.ts`)

**10 项核心指标:**
1. 信号接收总量
2. 过滤拦截率
3. 交易执行延迟
4. Rug Pull 拦截次数
5. 入场偏差分布
6. 胜率
7. 最大单笔亏损
8. 系统运行时间
9. 地址池活跃率
10. 跟卖触发率

**每日报告:** 23:55 UTC → Redis pub/sub `dexauto:kpi:daily`

### 10.2 Backtest Engine

**BacktestService** (`automatic-strategy/backtest/backtest.service.ts`)

- ClickHouse `dex_trades` 历史数据回放
- 模拟共识触发（N 地址在时间窗口内）→ 虚拟入场
- 追踪价格走势 → 止损/止盈/最大持仓时间退出
- 输出: 胜率、Sharpe 比率、最大亏损、总 PnL、逐笔明细
- 安全: base58 正则验证地址，数值参数范围钳位

### 10.3 策略配置

**StrategyConfigService** (`automatic-strategy/strategy-config.service.ts`)

20+ 可配置参数（Redis + 内存缓存）:
- 触发参数: 共识地址数、SOL 阈值、时间窗口
- 过滤参数: 市值范围、流动性要求、代币年龄
- 安全参数: 最低 RugCheck 分数、LP 燃烧率
- 仓位参数: 最大并发、单代币敞口、总预算
- 退出参数: 止损点、止盈梯度、最大持仓时间
- 入场偏差: 最大偏差%、减仓偏差范围
- Probe 检测: 阈值、TTL、群体覆盖阈值

### 10.4 Dashboard REST API

**DashboardController** (`automatic-strategy/automatic-strategy-dashboard.controller.ts`)

17 个端点（全部 `@UseGuards(AuthGuard)`）:

| 路由 | 方法 | 功能 |
|------|------|------|
| `/dashboard/kpi/live` | GET | 实时 KPI |
| `/dashboard/kpi/history` | GET | 历史 KPI |
| `/dashboard/kpi/:date` | GET | 指定日期 KPI |
| `/dashboard/fund/status` | GET | 资金状态 |
| `/dashboard/fund/config` | GET/POST | 资金配置 |
| `/dashboard/deviation/stats` | GET | 偏差统计 |
| `/dashboard/deviation/records` | GET | 偏差记录 |
| `/dashboard/positions` | GET | 全部持仓 |
| `/dashboard/positions/:mint` | GET | 指定代币持仓 |
| `/dashboard/wallets/tiers` | GET | 钱包分级 (Top 100) |
| `/dashboard/backtest/run` | POST | 执行回测 |
| `/dashboard/strategy-config/:id` | GET/POST | 策略参数 |
| `/dashboard/strategy-config/:id/reset` | POST | 重置默认 |

---

## 11. 服务索引

### Node.js (NestJS)

| 服务 | 文件路径 | 职责 |
|------|----------|------|
| GeyserSubscriberService | `geyser-subscriber/geyser-subscriber.service.ts` | Yellowstone gRPC 实时数据流 |
| ShredStreamPrefetchService | `geyser-subscriber/shredstream-prefetch.service.ts` | ShredStream 预确认信号 |
| FollowSellService | `geyser-subscriber/follow-sell.service.ts` | 跟卖检测 |
| RealtimeExitLiquidityService | `geyser-subscriber/realtime-exit-liquidity.service.ts` | Circuit Breaker 熔断 |
| BurstWalletDetectorService | `geyser-subscriber/burst-wallet-detector.service.ts` | 未知钱包实时发现 |
| AutomaticStrategySyncerService | `automatic-strategy-syncer/automatic-strategy-syncer.service.ts` | 策略同步与执行器管理 |
| AutomaticStrategyExecutor | `automatic-strategy-syncer/utils/automatic-strategy-executor.ts` | 核心策略评估引擎 |
| CopyTradeFilter | `automatic-strategy-syncer/utils/copy-trade-filter.ts` | 多维度买入过滤 |
| SmartWalletSourceService | `smart-wallet-source/smart-wallet-source.service.ts` | 多源钱包导入管理 |
| WalletScorerService | `wallet-scorer/wallet-scorer.service.ts` | 钱包评分与分级 |
| AddressClusterService | `wallet-scorer/address-cluster.service.ts` | Sybil 集群检测 |
| KpiDashboardService | `wallet-scorer/kpi-dashboard.service.ts` | KPI 指标采集与报告 |
| TokenSecurityService | `token-security/token-security.service.ts` | 代币安全多层检查 |
| PositionMonitorService | `position-monitor/position-monitor.service.ts` | 持仓追踪与退出规则 |
| PositionManagerService | `position-manager/position-manager.service.ts` | 持仓记录（加权成本基准）|
| FundAllocatorService | `position-manager/fund-allocator.ts` | 资金分配 |
| EntryDeviationMonitorService | `position-manager/entry-deviation-monitor.ts` | 入场偏差检测 |
| BacktestService | `automatic-strategy/backtest/backtest.service.ts` | 历史回测引擎 |
| StrategyConfigService | `automatic-strategy/strategy-config.service.ts` | 策略参数配置 |
| DashboardController | `automatic-strategy/automatic-strategy-dashboard.controller.ts` | REST API 端点 |
| MessageNotifierService | `message-notifier/message-notifier.service.ts` | 消息推送 |

### Rust (Actix-Web)

| 模块 | 文件路径 | 职责 |
|------|----------|------|
| JitoClient | `utils/src/jito_client.rs` | Jito Block Engine 通信 |
| TxSubmitter | `utils/src/tx_submitter/submitter.rs` | 三级路由提交 + Bundle 构建 |
| PendingTransaction | `utils/src/tx_submitter/pending_transaction.rs` | 交易任务结构 |
| runner | `utils/src/tx_submitter/runner.rs` | 后台 Worker Loop |
| Jupiter swap | `tx-builder/src/jupiter/swap.rs` | Jupiter V2 报价/交易构建 |
| Swap API | `api/src/trading_swap/swap.rs` | HTTP 交易提交端点 |
| main | `src/main.rs` | 服务启动与 Worker 初始化 |

---

## 12. 部署依赖

### 环境变量

```bash
# 数据库
DATABASE_URL=postgres://...
CLICKHOUSE_URL=http://...

# Solana RPC
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
STAKED_RPC_URL=https://staked.helius-rpc.com?api-key=...

# Yellowstone gRPC
GEYSER_GRPC_ENDPOINT=https://...
GEYSER_GRPC_TOKEN=...

# ShredStream (本地 sidecar)
SHREDSTREAM_GRPC_ENDPOINT=http://127.0.0.1:9999

# Jito
JITO_REGION=tokyo          # 或 ny/slc/amsterdam/frankfurt
JITO_ENDPOINT=              # 可选自定义端点

# 交易签名
TX_SUBMITTER_PRIVATE_KEY=   # Base58 编码密钥对（用于签名 tip 交易）

# Jupiter
JUPITER_API_KEY=...

# Helius
HELIUS_API_KEY=...

# Redis
REDIS_URL=redis://...

# 发现 API
GMGN_API_KEY=...
BIRDEYE_API_KEY=...
CIELO_API_KEY=...
```

### 外部服务

| 服务 | 用途 | 必需 |
|------|------|------|
| jito-shredstream-proxy | 本地 gRPC sidecar (ShredStream) | 可选（推荐）|
| Yellowstone gRPC | 确认后实时数据 | 必需 |
| Jupiter V2 API | DEX 聚合报价/交易构建 | 必需 |
| Jito Block Engine | Bundle 原子提交 | 必需 |
| ClickHouse | 历史交易数据/回测 | 必需 |
| Redis | 缓存/ZSet/pub-sub | 必需 |
| RugCheck API | 代币安全评分 | 推荐 |
| Firebase | 实时推送通知 | 可选 |

### ShredStream Sidecar 部署

```bash
# 使用官方 Docker 镜像
docker run -d \
  --name shredstream-proxy \
  -p 9999:9999 \
  jitolabs/shredstream-proxy:latest \
  --grpc-service-port 9999 \
  --block-engine-url https://tokyo.mainnet.block-engine.jito.wtf \
  --auth-keypair /path/to/keypair.json
```
