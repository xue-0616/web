# 聪明钱跟单策略全面升级方案

> 目标：将现有聪明钱跟单系统升级至第一梯队水平，对标 GMGN / Bullx 等头部平台  
> 编写时间：2026-04-12  
> 基于最新 Solana 生态技术栈和竞品分析

---

## 一、现有系统 vs 第一梯队差距总览

| 能力维度 | 当前系统 | 第一梯队标准 | 差距等级 |
|---------|---------|-------------|---------|
| 数据源延迟 | WebSocket → ClickHouse → 推送 (5-30s) | Yellowstone gRPC 直连 validator (<500ms) | 🔴 致命 |
| 聪明钱发现 | 硬编码 111 个地址 | 动态评分系统，每日自动更新 Top 500 | 🔴 致命 |
| 代币安全检查 | 黑名单 12 个主流代币 | RugCheck API + 链上实时检测 | 🔴 致命 |
| 止损机制 | 无 | 固定止损 + 跟踪止损 | 🔴 致命 |
| DEX 覆盖 | Jupiter + Raydium V4 | Jupiter V2 + Pump.fun + Raydium + Meteora + Orca | 🟡 重要 |
| MEV 保护 | NextBlock (已过时) | Jito Bundle API | 🟡 重要 |
| 优先费 | 固定 0.005 SOL | 动态获取 + Jito Tip | 🟡 重要 |
| 卖出策略 | 固定 2x 卖一半 | 跟卖 + 批量止盈止损 + 跟踪止损 | 🟡 重要 |
| 买入过滤 | 多地址共识（独特优势） | 市值/流动性/创建时间/平台过滤 | 🟢 增强 |
| 跟单模式 | 固定金额 | 固定/比例/最大金额 多模式 | 🟢 增强 |
| 通知系统 | 推送通知 | TG Bot 交互式管理 | 🟢 增强 |

---

## 二、升级架构设计

### 2.1 目标架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户层 (Telegram Bot)                      │
│  创建跟单任务 / 管理策略 / 查看持仓 / 手动卖出 / 接收通知          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     策略引擎 (Node.js/NestJS)                     │
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│  │ 聪明钱发现    │ │ 信号处理      │ │ 风控引擎                │   │
│  │ WalletScorer │ │ SignalRouter  │ │ RiskManager            │   │
│  │              │ │              │ │ - TokenSecurityCheck    │   │
│  │ - PnL 计算   │ │ - 共识检测   │ │ - RugCheck API         │   │
│  │ - 胜率统计   │ │ - 信号评分   │ │ - 流动性检查            │   │
│  │ - 地址聚类   │ │ - 过滤条件   │ │ - Dev 持仓检查          │   │
│  │ - 自动更新   │ │ - 去重       │ │ - 止损/止盈监控         │   │
│  └──────────────┘ └──────────────┘ └────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              仓位管理器 PositionManager                     │   │
│  │  - 持仓跟踪 / 均价计算 / 盈亏统计 / 跟踪止损              │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                   交易执行层 (Rust Server)                        │
│                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐     │
│  │ Jupiter V2   │ │ Jito Bundle  │ │ 动态费用              │     │
│  │ Swap API     │ │ Submitter    │ │ DynamicFeeEstimator  │     │
│  └──────────────┘ └──────────────┘ └──────────────────────┘     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     数据层 (实时 + 历史)                          │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Yellowstone gRPC │  │ ClickHouse   │  │ Redis           │   │
│  │ (实时交易流)      │  │ (历史分析)    │  │ (缓存/锁/队列)  │   │
│  └──────────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流（升级后）

```
聪明钱链上交易
    │
    ▼
Yellowstone gRPC (Helius/QuickNode)
    │ ~200ms 延迟
    ▼
gRPC 事件解析器 ──→ 识别 DEX Swap 交易
    │                  解析 program instructions
    │                  提取 inputMint/outputMint/amount
    │
    ▼
信号处理器 SignalRouter
    │
    ├─→ 共识检测（多地址同买同一代币？）
    ├─→ 过滤条件（市值/流动性/创建时间/平台）
    ├─→ 钱包质量评分（该地址历史胜率/PnL）
    │
    ▼
风控引擎 RiskManager
    │
    ├─→ RugCheck API 安全扫描
    ├─→ 链上检查（mint authority / freeze authority / LP burnt）
    ├─→ Dev 持仓比例检查
    ├─→ 仓位限制检查
    │
    ▼ 通过
交易执行
    │
    ├─→ Jupiter Swap V2 API 获取 Quote
    ├─→ 构建交易 + Jito Tip
    ├─→ Jito Bundle 提交
    │
    ▼
仓位管理 + 止盈止损监控
    │
    ├─→ 固定止损（跌 X% 卖出）
    ├─→ 跟踪止损（从最高点回撤 Y% 卖出）
    ├─→ 分批止盈（涨到不同倍数卖不同比例）
    ├─→ 跟卖（聪明钱卖出时同步卖）
    │
    ▼
通知 + 统计
```

---

## 三、各模块详细升级方案

### 3.1 数据源升级：Yellowstone gRPC

**现状**：通过 dexauto-data-center (Go Substreams) → ClickHouse → WebSocket 推送，延迟 5-30 秒。

**升级为**：Yellowstone gRPC 直连 Solana validator，延迟 < 500ms。

**技术方案**：

```typescript
// 新增模块: src/modules/geyser-subscriber/geyser-subscriber.service.ts

import Client, { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";

// 服务商选择（按推荐顺序）：
// 1. Helius LaserStream — 延迟最低，从 $49/月起
//    endpoint: "https://mainnet.helius-rpc.com"
// 2. QuickNode Yellowstone — $49/月起
//    endpoint: 通过 QuickNode dashboard 获取
// 3. Chainstack — 按流数量收费
// 4. Shyft — 免费层可用

const GEYSER_ENDPOINT = process.env.GEYSER_GRPC_ENDPOINT;
const GEYSER_TOKEN = process.env.GEYSER_GRPC_TOKEN;

// 订阅监控地址的所有交易
const subscribeRequest: SubscribeRequest = {
  transactions: {
    smartMoney: {
      accountInclude: monitorAddresses,  // 动态注入监控地址列表
      accountExclude: [],
      accountRequired: [],
      vote: false,
      failed: false,
    }
  },
  commitment: CommitmentLevel.CONFIRMED,
  ping: { id: 1 }
};
```

**改造要点**：
- 新建 `GeyserSubscriberService` 替代现有 `TransferSubscriberService` 中的 WebSocket 逻辑
- 保留 ClickHouse 用于历史分析和钱包评分，但实时信号走 gRPC
- 支持动态增删订阅地址（gRPC stream 可发送更新请求）

**费用**：
| 服务商 | 月费 | 延迟 | 推荐度 |
|--------|------|------|--------|
| Helius LaserStream | $49-$499 | ~200ms | ⭐⭐⭐⭐⭐ |
| QuickNode | $49-$299 | ~300ms | ⭐⭐⭐⭐ |
| Chainstack | $49+ | ~400ms | ⭐⭐⭐ |

---

### 3.2 聪明钱动态发现与评分系统

**现状**：硬编码 111 个地址，无评分，无更新机制。

**升级为**：自动发现 + 多维评分 + 定期淘汰更新。

**评分模型**：

```typescript
// 新增模块: src/modules/wallet-scorer/wallet-scorer.service.ts

interface WalletScore {
  address: string;
  
  // 核心指标
  pnl30d: number;           // 30天已实现 PnL (SOL)
  winRate30d: number;        // 30天胜率 (0-1)
  avgHoldTime: number;       // 平均持仓时间 (秒)
  tradeCount30d: number;     // 30天交易次数
  avgPositionSize: number;   // 平均仓位大小 (SOL)
  
  // 风险指标
  maxDrawdown: number;       // 最大回撤
  rugPullCount: number;      // 参与 rug pull 次数
  bundleCount: number;       // 参与 bundle 交易次数 (可能是 dev)
  
  // 计算得分
  compositeScore: number;    // 综合评分 0-100
  tier: 'S' | 'A' | 'B' | 'C';  // 等级
}

// 评分公式
function calculateScore(w: WalletMetrics): number {
  const pnlScore = Math.min(w.pnl30d / 100, 1) * 30;        // 30分: PnL
  const winRateScore = w.winRate30d * 25;                      // 25分: 胜率
  const consistencyScore = Math.min(w.tradeCount30d / 50, 1) * 15; // 15分: 活跃度
  const holdTimeScore = getHoldTimeScore(w.avgHoldTime) * 10;  // 10分: 持仓时间
  const safetyScore = (1 - w.rugPullCount / 10) * 20;         // 20分: 安全性
  
  return pnlScore + winRateScore + consistencyScore + holdTimeScore + safetyScore;
}

// 等级划分
// S 级 (85+)：顶级 alpha，共识权重 x3
// A 级 (70-84)：优质地址，共识权重 x2  
// B 级 (50-69)：一般地址，共识权重 x1
// C 级 (<50)：待观察，不参与共识
```

**地址发现来源**：

| 来源 | 方法 | 频率 |
|------|------|------|
| 历史交易分析 | 扫描 ClickHouse 中所有 DEX 交易，按 PnL 排名 | 每日 |
| GMGN Top Traders | 爬取热门代币 Top 100 交易者 | 每日 |
| 链上聚类 | 分析 bundle 交易中的关联钱包 | 每周 |
| chain.fm 频道 | 保留现有订阅机制 | 实时 |
| 手动添加 | 用户可手动添加 KOL 地址 | 随时 |

**自动淘汰机制**：
```
每 24 小时运行一次：
1. 重新计算所有监控地址的评分
2. 评分 < 30 的地址降级为 C 级，不参与共识触发
3. 连续 7 天评分 < 20 的地址自动移除
4. 从发现源补充新的高评分地址
5. 总监控地址上限 500 个
```

**地址池分层使用策略**：
```
总池 500 个地址，但按等级严格分层：

决策层（触发共识）：仅 S + A 级，约 50-80 个
  └── 必须满足质量门槛：≥1 个 S 级 或 ≥3 个 A 级参与

辅助层（加分但不独立触发）：B 级，约 100-150 个
  └── 有 B 级地址同买可加分，但仅靠 B 级无法触发

观察层（不参与任何决策）：C 级，约 200-300 个
  └── 仅用于积累数据、评估是否升级为 B/A 级

⚠️ 不要因为想增加信号量就降低 S/A 门槛，
   宁可少交易也不跟低质量信号。
```

**关键改造文件**：
- 新建 `src/modules/wallet-scorer/` 模块
- 修改 `automatic-strategy-executor.ts` 中的 `validateStrategyTrigger()` 方法，接入评分加权

---

### 3.3 代币安全检查 (Anti-Rug)

**现状**：仅黑名单过滤 12 个主流代币，无安全检测。

**升级为**：多层安全检查，在买入前拦截高风险代币。

**方案**：

```typescript
// 新增模块: src/modules/token-security/token-security.service.ts

interface TokenSecurityResult {
  mint: string;
  riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;         // 0-100, 越高越安全
  checks: {
    // 传统 Token Program 检查
    mintAuthority: boolean;      // true = 已撤销 (安全)
    freezeAuthority: boolean;    // true = 已撤销 (安全)
    
    // Token-2022 扩展检查 (关键！2025-2026 年主要 rug 手法)
    hasPermanentDelegate: boolean;   // 永久委托 → 可随时销毁/转走你的代币
    hasTransferHook: boolean;        // 转账钩子 → 可阻止卖出或附加隐藏逻辑
    hasNonTransferable: boolean;     // 不可转让 → 代币直接无法卖出
    hasTransferFee: boolean;         // 转账税 → 隐藏的买卖税
    hasConfidentialTransfer: boolean; // 机密转账 → 可隐藏增发/转移，隐形蜜罐
    isToken2022: boolean;            // 是否使用 Token-2022 程序
    
    // 流动性与持仓检查
    lpBurntRatio: number;        // LP 烧毁比例 0-1
    top10HolderPct: number;      // Top10 持有者占比
    devHolderPct: number;        // Dev 持有比例
    liquidityUsd: number;        // 流动性 (USD)
    tokenAge: number;            // 代币存在时间 (秒)
    isHoneypot: boolean;         // 蜜罐检测
    
    // RugCheck API
    rugcheckTrustScore: number;  // RugCheck Trust Score 0-100 (越高越安全)
    rugcheckRiskLevel: string;   // RugCheck Risk Level: LOW/MEDIUM/HIGH/CRITICAL
  };
  passesFilter: boolean;
}

// 检查流程（串行，任一不通过即拒绝）
async function checkTokenSecurity(mint: string): Promise<TokenSecurityResult> {
  
  // 第 1 层：快速链上检查 (~50ms)
  // 直接 RPC 查询 Mint Account 信息
  const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
  const mintAuthority = mintInfo.value.data.parsed.info.mintAuthority;
  const freezeAuthority = mintInfo.value.data.parsed.info.freezeAuthority;
  
  // 如果 mint authority 未撤销 → HIGH RISK
  if (mintAuthority !== null) {
    return { riskLevel: 'HIGH', passesFilter: false, ... };
  }
  
  // 第 1.5 层：Token-2022 扩展检查 (~50ms) 【P0 关键！】
  // 检查代币是否使用 Token-2022 程序及其危险扩展
  const tokenProgram = mintInfo.value.owner; // TokenkegQ... 或 TokenzQd...
  const isToken2022 = tokenProgram.equals(TOKEN_2022_PROGRAM_ID);
  
  if (isToken2022) {
    const extensions = getExtensions(mintInfo);
    
    // 永久委托 (Permanent Delegate)
    // 允许指定地址随时销毁/转走任何持有者账户中的代币
    // 即使 LP 已锁定，攻击者也能清空你的余额
    if (extensions.includes(ExtensionType.PermanentDelegate)) {
      return { riskLevel: 'CRITICAL', passesFilter: false,
        reason: 'Token-2022 Permanent Delegate: 可随时销毁你的代币' };
    }
    
    // 转账钩子 (Transfer Hook)
    // 每笔转账执行自定义合约逻辑，可能：
    // - 阻止卖出（蜜罐）
    // - 收取隐藏高额税
    // - 因 CU 耗尽导致大额卖出失败
    if (extensions.includes(ExtensionType.TransferHook)) {
      return { riskLevel: 'CRITICAL', passesFilter: false,
        reason: 'Token-2022 Transfer Hook: 可劫持/阻止卖出交易' };
    }
    
    // 不可转让 (Non-Transferable)
    if (extensions.includes(ExtensionType.NonTransferable)) {
      return { riskLevel: 'CRITICAL', passesFilter: false,
        reason: 'Token-2022 Non-Transferable: 代币无法卖出' };
    }
    
    // 转账税 (TransferFeeConfig)
    // 检查是否有隐藏的买卖税
    if (extensions.includes(ExtensionType.TransferFeeConfig)) {
      const feeConfig = getTransferFeeConfig(mintInfo);
      if (feeConfig.feeBasisPoints > 500) { // > 5% 税率
        return { riskLevel: 'HIGH', passesFilter: false,
          reason: `Token-2022 Transfer Fee ${feeConfig.feeBasisPoints/100}% 过高` };
      }
    }
    
    // 机密转账 (Confidential Transfer) 【v2.1 新增】
    // 使用 ZK 证明隐藏转账金额，可被用于：
    // - 隐藏增发（链上监控工具如 Bubblemaps 无法检测真实供应量）
    // - 隐藏 Dev 自买自卖（伪造持仓分布）
    // - Meme 币没有任何正当理由开启此功能
    if (extensions.includes(ExtensionType.ConfidentialTransferMint)) {
      return { riskLevel: 'CRITICAL', passesFilter: false,
        reason: 'Token-2022 Confidential Transfer: 可隐藏增发/转移，极大概率为隐形蜜罐' };
    }
  }
  
  // 第 2 层：RugCheck API (~200ms)
  // API: GET https://api.rugcheck.xyz/v1/tokens/{mint}/report
  const rugcheckResult = await fetch(
    `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
    { headers: { 'x-api-key': RUGCHECK_API_KEY } }
  ).then(r => r.json());
  
  // 注意区分两个指标：
  // - trustScore: 0-100, 越高越安全, 要求 ≥ 70
  // - riskLevel: LOW/MEDIUM/HIGH/CRITICAL, 要求 ∈ {LOW, MEDIUM}
  if (rugcheckResult.trustScore < 70 || 
      ['HIGH', 'CRITICAL'].includes(rugcheckResult.riskLevel)) {
    return { riskLevel: 'HIGH', passesFilter: false,
      reason: `RugCheck 不通过: trust=${rugcheckResult.trustScore}, risk=${rugcheckResult.riskLevel}` };
  }
  
  // 第 3 层：流动性和持仓检查 (~100ms)
  // 查询 LP 池信息，检查 LP token 是否已 burn
  // 查询 top holders，计算集中度
  
  return result;
}
```

**安全过滤规则（可配置）**：

| 检查项 | 默认阈值 | 说明 |
|--------|---------|------|
| Mint Authority | 必须已撤销 | 否则项目方可无限增发 |
| Freeze Authority | 必须已撤销 | 否则可冻结你的代币 |
| **Permanent Delegate** | **必须不存在** | **Token-2022: 可随时销毁你的代币 [P0]** |
| **Transfer Hook** | **必须不存在** | **Token-2022: 可劫持/阻止卖出 [P0]** |
| **Non-Transferable** | **必须不存在** | **Token-2022: 代币无法卖出 [P0]** |
| **Transfer Fee** | **≤ 5%** | **Token-2022: 隐藏的买卖税** |
| **Confidential Transfer** | **必须不存在** | **Token-2022: 可隐藏增发/转移，隐形蜜罐 [P0]** |
| LP Burnt 比例 | ≥ 50% | 低于此值 LP 可随时撤走 |
| Top 10 持仓占比 | ≤ 40% | 过于集中易被砸盘 |
| Dev 持仓占比 | ≤ 10% | Dev 持仓过大 = rug 风险 |
| 最低流动性 | ≥ $10,000 | 低流动性难以卖出 |
| 代币最短存在时间 | ≥ 60 秒 | 过新的币风险极高 |
| RugCheck Trust Score | **≥ 70 / 100** | 信任评分，越高越安全 |
| RugCheck Risk Level | **LOW 或 MEDIUM** | 排除 HIGH 和 CRITICAL |

**RugCheck API 集成**：
```
注册: https://rugcheck.xyz
API端点: https://api.rugcheck.xyz/v1/tokens/{mint}/report
返回字段:
  - riskLevel: LOW / MEDIUM / HIGH / CRITICAL  ← 要求 LOW 或 MEDIUM
  - trustScore: 0-100 (越高越安全)              ← 要求 ≥ 70
  - scams: [HONEYPOT, FAKE_TOKEN, RUG_PULL, ...]
  - liquidityDetails: { totalLiquidity, liquidityLocked }
  - holderAnalysis: { topHoldersConcentration }
费用: 免费层 100 次/天, 付费层按需

⚠️ 注意: trustScore 和 riskLevel 必须同时满足条件，
   不能只看一个指标。trustScore ≥ 70 但 riskLevel = HIGH 仍应拒绝。
```

**Token-2022 扩展检测**（Phase 1 必须实现）：
```
Token-2022 Program ID: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

检测方法: 解析 Mint Account 的 extension data
  1. 检查 account.owner 是否为 Token-2022 Program
  2. 如果是，解析 tlv_data 获取扩展列表
  3. 拦截以下扩展:
     - PermanentDelegate (type=9)  → 直接拒绝
     - TransferHook (type=13)      → 直接拒绝
     - NonTransferable (type=5)    → 直接拒绝
     - TransferFeeConfig (type=1)  → fee > 5% 拒绝
     - ConfidentialTransferMint (type=6) → 直接拒绝 【v2.1 新增】

Rust 实现: 使用 spl-token-2022 crate 的 ExtensionType::try_get_account_len()
Node.js: @solana/spl-token 的 getExtensionTypes() + getMint()
```

---

### 3.4 止盈止损系统全面升级

**现状**：仅 DoubleSell (固定 2x 卖一半)，无止损。

**升级为**：4 种卖出模式，可组合使用。

```typescript
// 改造模块: src/common/pendingOrder.ts + 新增 positionManager

// ===== 模式 1: 跟卖 (Follow Sell) =====
// 当跟单的聪明钱卖出时，同步卖出对应比例
// 例：聪明钱卖出其持仓的 30%，你也卖出跟单仓位的 30%
interface FollowSellConfig {
  enabled: boolean;
  // 仅在跟单买入的持仓上生效
}

// ===== 模式 2: 固定止盈止损 =====
interface FixedTPSLConfig {
  takeProfitPct: number;   // 止盈百分比，如 100 = 涨 100% 卖出
  stopLossPct: number;     // 止损百分比，如 30 = 跌 30% 卖出
  sellRatio: number;       // 触发时卖出比例，如 0.5 = 卖一半
}

// ===== 模式 3: 分批止盈止损 (GMGN 模式) =====
// 可配置多组规则，每组独立触发
interface BatchTPSLConfig {
  rules: Array<{
    type: 'takeProfit' | 'stopLoss';
    triggerPct: number;     // 触发百分比
    sellRatio: number;      // 卖出比例
    onlyOnce: boolean;      // 同一规则只触发一次（加仓后重置）
  }>;
}
// 示例配置：
// rule 1: 涨 50% → 卖 30% (回本)
// rule 2: 涨 200% → 卖 30% (锁利)
// rule 3: 涨 500% → 卖 30% (大赚)
// rule 4: 跌 30% → 卖 100% (止损)

// ===== 模式 4: 跟踪止损 (Trailing Stop Loss) =====
interface TrailingStopConfig {
  enabled: boolean;
  activationPct: number;   // 激活阈值，如 20 = 涨 20% 后开始跟踪
  distancePct: number;     // 跟踪距离，如 10 = 从最高点回撤 10% 触发
}
// 执行逻辑：
// 1. 买入后持续追踪代币最高价
// 2. 当盈利达到 activationPct 时激活跟踪止损
// 3. 从最高价回撤 distancePct 时卖出
// 4. 止损价只会上移，永不下移

// 优先级：跟踪止损 > 固定止盈 > 固定止损 > 跟卖
```

**价格监控方案**：

```typescript
// 新增: src/modules/price-monitor/price-monitor.service.ts

// 方案A（推荐）: 通过 Yellowstone gRPC 监控池子账户变更
// 实时获取 AMM pool 的 reserve 变化 → 计算价格
// 优点：延迟最低，无额外 API 调用

// 方案B: 定期轮询 Jupiter Quote API
// GET https://api.jup.ag/swap/v1/quote?inputMint={token}&outputMint={WSOL}&amount={1token}
// 每 5-10 秒查询一次
// 优点：简单可靠，价格最准确

// 实际建议：方案 A 做实时粗略监控，方案 B 做触发前精确确认
```

---

### 3.5 买入过滤条件升级

**现状**：仅有多地址共识检测（PurchaseAddrUpper / PurchaseSolUpper / PurchaseAddrAndSolUpper）。

**升级为**：保留共识检测优势，增加 GMGN 同等级过滤条件。

```typescript
// 改造: automatic-strategy-executor.ts → syncAccountDexTrade()

interface CopyTradeFilter {
  // === 现有（保留并增强）===
  consensus: {
    minAddressCount: number;        // 最少共识地址数
    minSolPerAddress: number;       // 每个地址最低买入金额
    minTotalSol: number;            // 总最低买入金额
    weightByTier: boolean;          // 是否按地址等级加权
  };
  
  // === 新增过滤条件 ===
  marketCap: {
    min: number | null;             // 最低市值 (USD)
    max: number | null;             // 最高市值 (USD)
  };
  
  liquidity: {
    min: number | null;             // 最低流动性 (USD)
    max: number | null;             // 最高流动性 (USD)
  };
  
  tokenAge: {
    min: number | null;             // 代币最短存在时间 (秒)
    max: number | null;             // 代币最长存在时间 (秒)
  };
  
  copyAmount: {
    min: number | null;             // 跟单最低金额 (SOL)
    max: number | null;             // 跟单最高金额 (SOL)，防止拉盘诱导
  };
  
  platform: string[];               // 限制代币来源平台
  // ['pump.fun', 'raydium', 'meteora', 'orca']
  
  lpBurntMinRatio: number | null;   // LP 最低烧毁比例
  
  maxPositionIncreases: number;     // 同一代币最大加仓次数
  
  blacklist: string[];              // 代币黑名单
}
```

**共识检测加权升级**（保持你的核心优势）：

```typescript
// 在 validateStrategyTrigger() 中升级共识逻辑

function calculateWeightedConsensus(txs: StrategyTx[], walletScores: Map<string, WalletScore>): number {
  let weightedCount = 0;
  const uniqueAddresses = new Set<string>();
  
  for (const tx of txs) {
    if (uniqueAddresses.has(tx.monitorAddress.address)) continue;
    uniqueAddresses.add(tx.monitorAddress.address);
    
    const score = walletScores.get(tx.monitorAddress.address);
    if (!score) continue;
    
    switch (score.tier) {
      case 'S': weightedCount += 3; break;  // S 级地址 = 3 票
      case 'A': weightedCount += 2; break;  // A 级地址 = 2 票
      case 'B': weightedCount += 1; break;  // B 级地址 = 1 票
      case 'C': break;                       // C 级不计入
    }
  }
  
  return weightedCount;
}

// ===== 共识质量门槛（硬性要求）=====
// 仅靠 B/C 级地址堆数量不能触发，必须有高质量地址参与
function meetsMinimumQuality(txs: StrategyTx[], walletScores: Map<string, WalletScore>): boolean {
  let sCount = 0, aCount = 0;
  const seen = new Set<string>();
  for (const tx of txs) {
    if (seen.has(tx.monitorAddress.address)) continue;
    seen.add(tx.monitorAddress.address);
    const score = walletScores.get(tx.monitorAddress.address);
    if (score?.tier === 'S') sCount++;
    if (score?.tier === 'A') aCount++;
  }
  // 至少 1 个 S 级，或至少 3 个 A 级
  return sCount >= 1 || aCount >= 3;
}

// 触发条件：
// 1. meetsMinimumQuality() === true（硬性门槛）
// 2. 加权共识值 >= 阈值
// 例：1 个 S 级 + 1 个 A 级 = 5 票 >= 阈值 4 → 触发 ✅（有 S 级）
// 例：5 个 B 级 = 5 票 >= 阈值 4 → 不触发 ❌（无 S/A 级，不满足质量门槛）
// 例：3 个 A 级 = 6 票 >= 阈值 4 → 触发 ✅（A 级 ≥ 3）
```

---

### 3.6 交易执行层升级

#### 3.6.1 Jupiter Swap API 升级

**现状**：使用旧版 Jupiter API（自建 Jupiter URL）。

**升级为**：Jupiter Swap V2 API（最新）。

```typescript
// 改造: Rust crate tx-builder/src/jupiter/swap.rs

// 新 API 端点 (2025-2026)：
// Quote: GET https://api.jup.ag/swap/v1/quote
// Swap:  POST https://api.jup.ag/swap/v1/swap
// 需要 API Key: 在 https://developers.jup.ag 注册获取

// Quote 请求示例
const quoteUrl = 'https://api.jup.ag/swap/v1/quote?' + new URLSearchParams({
  inputMint: 'So11111111111111111111111111111111111111112',  // SOL
  outputMint: tokenMint,
  amount: amountInLamports.toString(),
  slippageBps: '300',                    // 3% 滑点
  restrictIntermediateTokens: 'true',    // 限制中间代币，减少路由风险
}).toString();

const quoteResponse = await fetch(quoteUrl, {
  headers: { 'x-api-key': JUPITER_API_KEY }
}).then(r => r.json());

// Swap 请求
const swapResponse = await fetch('https://api.jup.ag/swap/v1/swap', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': JUPITER_API_KEY
  },
  body: JSON.stringify({
    quoteResponse,
    userPublicKey: walletAddress,
    dynamicComputeUnitLimit: true,    // 动态 CU 限制
    dynamicSlippage: true,             // 动态滑点（Jupiter 自动优化）
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        maxLamports: 1000000,          // 最大优先费 0.001 SOL
        priorityLevel: 'veryHigh'
      }
    }
  })
}).then(r => r.json());
```

**关键改动**：
- 删除 `crates/tx-builder/src/raydium_amm/` 中的 Raydium V4 直连逻辑（Jupiter 已聚合所有 DEX）
- 100% 通过 Jupiter Metis v1.6 路由引擎（Ultra V2 模式），自动覆盖 Pump.fun / Raydium / Meteora / Orca
- 使用 `dynamicSlippage` 让 Jupiter 自动优化滑点

**关于 Prop-AMMs 的说明**（v2.1 补充）：
```
2026 年 Prop-AMMs（HumidiFi、SolFi、Tessera V 等）已占据 SOL-Stablecoin 交易对 80%+ 的市场份额，
整体 Solana DEX 周交易量的 20%-40%（来源: Gate Research, Blockworks Research, Helius）。

但这与我们的策略关系有限，原因如下：
1. 我们交易的是新上线 meme 币，而非 SOL-USDC 大额交易对
2. Prop-AMMs 主要报价 SOL-Stablecoin 和少数头部成熟 meme 币
3. Blockworks Research 明确指出: "Prop AMMs are virtually absent from [long-tail assets]
   because it's too risky for them to actively manage liquidity for new assets,
   many of which don't even have live oracle price feeds."
4. 即使某个 meme 币成熟到有 Prop-AMM 报价，Jupiter 会自动路由到更优价格

结论：不需要额外处理 Prop-AMM，Jupiter 路由层已自动覆盖。
未来如果 Prop-AMMs 扩展到更多 meme 币，我们会自动受益。
```

#### 3.6.2 Jito Bundle 提交

**现状**：使用 NextBlock MEV 保护（已过时）。

**升级为**：Jito Bundle API。

```rust
// 改造: crates/utils/src/tx_submitter/submitter.rs

// Jito Block Engine 端点（选择最近的区域）：
// 美东: https://ny.mainnet.block-engine.jito.wtf
// 美西: https://slc.mainnet.block-engine.jito.wtf
// 阿姆斯特丹: https://amsterdam.mainnet.block-engine.jito.wtf
// 法兰克福: https://frankfurt.mainnet.block-engine.jito.wtf
// 东京: https://tokyo.mainnet.block-engine.jito.wtf

// 单笔交易提交（最简单，推荐起步用）：
// POST https://mainnet.block-engine.jito.wtf/api/v1/transactions
// - 自带 MEV 保护（防三明治攻击）
// - 设置 bundleOnly=true 启用 revert protection
// - 最低 tip: 1000 lamports

// Tip 账户（随机选一个，减少竞争）：
// 获取: GET https://mainnet.block-engine.jito.wtf/api/v1/bundles/tip_accounts
// 在交易中添加一笔 SOL 转账到 tip 账户

// Rust 实现要点：
async fn submit_via_jito(
    &self,
    signed_tx: &VersionedTransaction,
    tip_lamports: u64,
) -> Result<String> {
    let serialized = bincode::serialize(signed_tx)?;
    let encoded = base64::encode(&serialized);
    
    let response = self.client
        .post("https://mainnet.block-engine.jito.wtf/api/v1/transactions?bundleOnly=true")
        .header("Content-Type", "application/json")
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "sendTransaction",
            "params": [encoded, {"encoding": "base64"}]
        }))
        .send()
        .await?;
    
    // bundle_id 从 response header x-bundle-id 获取
    Ok(response.json::<Value>().await?["result"].as_str().unwrap().to_string())
}
```

**Jito Tip 最佳实践**（来自 Jito 官方文档 + v2.1 优化）：
- 将 Tip 指令集成在主交易内部，不要单独发送
- 不要用 Address Lookup Tables 来引用 Tip 账户
- 随机选择 Tip 账户以减少竞争
- **【v2.1】Tip 金额基于实时数据动态计算**：
  - 普通信号：最近 5 个 slot 的 P50（中位数）
  - 强信号（共识票 ≥10）：最近 5 个 slot 的 P75
  - 下限 10,000 lamports，上限 0.01 SOL

#### 3.6.3 动态费用

**现状**：固定 0.005 SOL 优先费 + 0.01 SOL 贿赂。

**升级为**：根据网络状况动态调整。

```typescript
// 新增: src/modules/fee-estimator/fee-estimator.service.ts

async function getDynamicFees(): Promise<{ priorityFee: number, jitoTip: number }> {
  // 方案 1: Helius Priority Fee API
  const response = await fetch('https://mainnet.helius-rpc.com/?api-key=XXX', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getPriorityFeeEstimate',
      params: [{ 
        accountKeys: [JUPITER_PROGRAM_ID],
        options: { priorityLevel: 'High' }
      }]
    })
  });
  
  // 方案 2: 查询最近 slot 的 fee 分布
  // 取 P75 作为基准，确保 75% 以上的交易能上链
  
  // 【v2.1 改进】Jito Tip 改为实时动态，基于最近 slot 数据
  // 不再使用固定倍数公式
  const jitoTipData = await getRecentJitoTips(); // 查询最近 5 个 slot 的 tip 分布
  
  return {
    priorityFee: estimatedFee,
    jitoTip: selectJitoTip(jitoTipData, consensusScore),
  };
}

// 【v2.1 新增】根据信号强度选择 Jito Tip 百分位
function selectJitoTip(tipData: JitoTipDistribution, consensusScore: number): number {
  // 普通信号（共识票数 4-9）：使用 P50（中位数），节省成本
  // 强信号（共识票数 ≥ 10）：使用 P75，提高上链概率
  const percentile = consensusScore >= 10 ? tipData.p75 : tipData.p50;
  
  // 下限保护：至少 10,000 lamports（Jito 最低要求）
  // 上限保护：最多 0.01 SOL（共识跟单不需要抢首个区块）
  return Math.max(10_000, Math.min(percentile, 10_000_000));
}
```

---

### 3.7 跟卖信号（新增核心功能）

**现状**：不跟卖，仅靠固定倍数自动卖出。

**升级为**：实时监控聪明钱卖出行为，同步卖出。

```typescript
// 新增逻辑在 geyser-subscriber 中

// 当 gRPC 收到聪明钱的交易时：
function onSmartMoneyTrade(trade: ParsedDexTrade) {
  const isBuy = trade.side === 'buy';
  const isSell = trade.side === 'sell';
  
  if (isBuy) {
    // 现有买入跟单逻辑
    processBuySignal(trade);
  }
  
  if (isSell) {
    // 新增：跟卖逻辑
    processSellSignal(trade);
  }
}

async function processSellSignal(trade: ParsedDexTrade) {
  // 1. 检查我们是否持有该代币
  const position = await positionManager.getPosition(trade.tokenMint);
  if (!position) return;
  
  // 2. 检查是哪个聪明钱在卖
  const wallet = walletScores.get(trade.trader);
  if (!wallet) return;
  
  // 3. 计算聪明钱卖出了其持仓的百分比
  const sellRatio = trade.tokenAmount / wallet.holdingAmount;
  
  // 4. 按比例卖出我们的持仓
  const mySellamount = position.amount * sellRatio;
  
  // 5. 只对"跟这个聪明钱买入"的持仓生效
  if (position.sourceAddress === trade.trader) {
    await executeSell(trade.tokenMint, mySellamount);
    notifyUser(`跟卖: ${wallet.name} 卖出 ${(sellRatio*100).toFixed(1)}%`);
  }
}
```

---

## 四、实施计划与优先级

### Phase 1：核心修复（第 1-2 周） — 从"不能用"到"能用"

| 任务 | 改动位置 | 工作量 | 效果 |
|------|---------|--------|------|
| Jito Bundle 替换 NextBlock | `crates/utils/src/tx_submitter/` | 2 天 | MEV 保护生效 |
| Jupiter V2 API 替换旧 API | `crates/tx-builder/src/jupiter/` | 2 天 | 支持所有 DEX |
| 基础止损 (固定 %) | `src/common/pendingOrder.ts` | 2 天 | 避免 100% 亏损 |
| 基础 Anti-rug (mint/freeze) | 新建 `token-security` 模块 | 1 天 | 过滤明显骗局 |
| **Token-2022 扩展检测 [P0]** | `token-security` 模块 | **1 天** | **拦截 Permanent Delegate / Transfer Hook 新型 rug** |
| 动态优先费 | `fee-estimator` 模块 | 1 天 | 交易不再失败 |

### Phase 2：数据层升级（第 3-4 周） — 从"慢"到"快"

| 任务 | 改动位置 | 工作量 | 效果 |
|------|---------|--------|------|
| Yellowstone gRPC 接入 | 新建 `geyser-subscriber` 模块 | 5 天 | 延迟降至 <1s |
| DEX Swap 交易解析器 | geyser-subscriber 内 | 3 天 | 实时解析买卖信号 |
| 跟卖信号 | geyser-subscriber + positionManager | 2 天 | 不错过卖出时机 |

### Phase 3：策略智能化（第 5-6 周） — 从"能用"到"好用"

| 任务 | 改动位置 | 工作量 | 效果 |
|------|---------|--------|------|
| 钱包评分系统 | 新建 `wallet-scorer` 模块 | 5 天 | 动态地址发现 |
| 加权共识触发 | `automatic-strategy-executor.ts` | 2 天 | 信号质量提升 |
| RugCheck API 集成 | `token-security` 模块 | 1 天 | 深度安全检测 |
| 高级过滤条件 | 策略实体 + executor | 3 天 | 对标 GMGN 过滤能力 |

### Phase 4：风控完善（第 7-8 周） — 从"好用"到"第一梯队"

| 任务 | 改动位置 | 工作量 | 效果 |
|------|---------|--------|------|
| 跟踪止损 | `price-monitor` + `pendingOrder` | 3 天 | 锁利不踏空 |
| 分批止盈止损 | `pendingOrder` 改造 | 3 天 | 对标 GMGN 卖出能力 |
| 仓位管理器 | 新建 `position-manager` 模块 | 3 天 | 精确持仓跟踪 |
| 地址聚类分析 | `wallet-scorer` 增强 | 3 天 | 防伪共识 |

---

## 五、技术栈与依赖更新

### 5.1 需要新增的依赖

```toml
# Rust (Cargo.toml)
jito-sdk = "0.2"              # Jito Bundle SDK
# 或直接 HTTP 调用 Jito JSON-RPC API（更简单）
```

```json
// Node.js (package.json)
{
  "@triton-one/yellowstone-grpc": "^2.0.0",   // Yellowstone gRPC client
  "@grpc/grpc-js": "^1.10.0",                  // gRPC 基础库
  "bs58": "^6.0.0"                              // 已有
}
```

### 5.2 需要的外部服务

| 服务 | 用途 | 费用 | 必要性 |
|------|------|------|--------|
| Helius / QuickNode | Yellowstone gRPC + RPC | $49-499/月 | 必需 |
| Jupiter API Key | Swap V2 API | 免费 (需注册) | 必需 |
| Jito Block Engine | MEV 保护 + 交易提交 | 免费 (Tip 形式) | 必需 |
| RugCheck API | 代币安全检测 | 免费层 100次/天 | 强烈推荐 |
| GMGN (爬虫) | 聪明钱发现 | 免费 (需绕 CF) | 可选 |

### 5.3 服务器要求

```
最低配置：
- 4 核 CPU / 16 GB 内存
- 100 Mbps 带宽
- 区域：美东或法兰克福（靠近 Jito Block Engine）
- 预算：~$80/月 (AWS/Hetzner)
```

---

## 六、升级后预期效果

| 指标 | 当前 | Phase 1 后 | Phase 4 后 | GMGN 水平 |
|------|------|-----------|-----------|----------|
| 信号延迟 | 5-30s | 5-30s | <1s | ~1s |
| 代币安全 | 无检查 | 基础检查 | 多层检查 | 多层检查 |
| 止损能力 | 无 | 固定止损 | 跟踪止损 | 跟踪止损 |
| DEX 覆盖 | 2 个 | 全部 (Jupiter) | 全部 | 全部 |
| 地址发现 | 手动 111 个 | 手动 | 自动 500+ | 自动 |
| MEV 保护 | 失效 | Jito | Jito | Jito |
| 手续费 | 0% | 0% | 0% | 1% |
| **预估胜率** | **<10%** | **~25%** | **~40%** | **~35%** |

**核心差异化优势（竞品没有的）**：
1. **加权共识触发** — 不是跟一个人，是等多个高质量聪明钱形成共识
2. **零手续费** — 高频交易下每月省 10+ SOL
3. **完全可控** — 策略私密，不泄露给第三方
4. **深度定制** — 可随时调整评分权重、触发阈值、过滤条件

---

## 七、关键注意事项

1. **渐进式升级**：不要一次性全改，按 Phase 顺序逐步上线，每个 Phase 后进行实盘小额测试
2. **小额测试先行**：每个新功能上线后用 0.1 SOL 跑 3-7 天，确认无 bug 再加仓
3. **监控和告警**：每个模块都要有完善的日志和错误告警，尤其是交易执行和止损模块
4. **API Key 安全**：Jupiter API Key、RugCheck Key、gRPC Token 全部走环境变量，不要硬编码
5. **回测验证**：在 ClickHouse 历史数据上回测新的评分模型和过滤条件，再上实盘

---

## 八、2026 年对抗性环境补充方案

> 以下补充内容针对 2026 年 Solana Meme 市场已进入"代理经济"时代的现实，
> 解决原方案中缺失的反操纵、资金管理和量化 KPI 问题。

### 8.1 反退出流动性陷阱 (Anti Exit-Liquidity)

**问题**：聪明钱标签本身已被武器化 — KOL 低位建仓 → 跟单者涌入拉高 → KOL 出货，跟单者变成退出流动性。

**检测与防御方案**：

```typescript
// 新增: src/modules/wallet-scorer/exit-liquidity-detector.ts

interface WalletBehaviorProfile {
  address: string;
  
  // 核心检测指标
  followedByBotCount: number;       // 有多少已知机器人在跟他
  avgPriceImpactOnBuy: number;      // 他买入后平均价格冲击 (%)
  avgTimeToSellAfterPump: number;   // 价格拉升后多久卖出 (秒)
  sellWhenFollowersBuy: number;     // "跟单者买入时他在卖出"的次数
  profitFromFollowers: number;      // 从跟单者接盘中获取的估算利润
  
  // 判定
  isLikelyExitLiquidityFarmer: boolean;
}

// 检测逻辑
function detectExitLiquidityFarmer(wallet: WalletMetrics): boolean {
  // 模式 1：买入后价格暴涨但他很快卖出
  // 正常聪明钱：买入 → 持有 → 价格涨 → 逐步获利
  // 退出流动性：买入 → 机器人跟入拉高 → 10分钟内全部出货
  if (wallet.avgHoldTimeOnProfitableTrades < 600 &&  // 赚钱的单子平均持仓 < 10 分钟
      wallet.winRate > 0.7 &&                          // 胜率异常高
      wallet.avgPriceImpactOnBuy > 5) {                // 他买入后平均涨 5%+（因为跟单者）
    return true;
  }
  
  // 模式 2：卖出时间与跟单者买入时间高度重叠
  if (wallet.sellWhenFollowersBuy / wallet.totalSells > 0.5) {
    return true;
  }
  
  return false;
}
```

**防御规则**：
- 被标记为 Exit Liquidity Farmer 的地址 → 自动降为 C 级，不参与共识
- 对所有 S/A 级地址每周做一次行为复审
- 新增指标 `avgHoldTime`：**持仓时间 < 5 分钟的"聪明钱"大概率是操纵者，不跟**

---

### 8.2 Wash Trading / 伪造信号检测

**问题**：庄家用多个关联钱包左手倒右手，制造虚假的"多钱包共识"。

**检测方案**：

```typescript
// 新增: src/modules/wallet-scorer/wash-trade-detector.ts

// ===== 关联钱包识别 =====
// 判定两个钱包是否为同一人控制

interface WalletCluster {
  addresses: string[];
  confidence: number;        // 关联置信度 0-1
  evidence: string[];
}

function detectRelatedWallets(address1: string, address2: string): number {
  let score = 0;
  
  // 信号 1: 资金来源相同
  // 两个钱包的初始 SOL 都来自同一个父钱包
  if (haveSameFundingSource(address1, address2)) score += 0.4;
  
  // 信号 2: 交易时序高度一致
  // 两个钱包总是在 <3 秒内买入同一个代币
  if (avgTimeDeltaOnSameToken(address1, address2) < 3) score += 0.3;
  
  // 信号 3: 资金循环
  // A → 买入 Token X → 转给 B → B 卖出 Token X
  if (hasCircularFundFlow(address1, address2)) score += 0.5;
  
  // 信号 4: Bundle 交易
  // 两个钱包出现在同一个 Jito bundle 中
  if (appearedInSameBundle(address1, address2)) score += 0.6;
  
  // 信号 5: 持仓模式雷同
  // 两个钱包买卖同一组代币，仓位比例接近
  if (portfolioSimilarity(address1, address2) > 0.8) score += 0.2;
  
  return Math.min(score, 1);
}

// ===== 共识去重 =====
// 在触发共识检测前，先将关联钱包合并为一个实体
function deduplicateConsensus(txs: StrategyTx[], clusters: WalletCluster[]): StrategyTx[] {
  const entityMap = new Map<string, string>(); // address → entityId
  
  for (const cluster of clusters) {
    const entityId = cluster.addresses[0]; // 用第一个地址代表整个集群
    for (const addr of cluster.addresses) {
      entityMap.set(addr, entityId);
    }
  }
  
  // 同一集群的多个地址只计为 1 票
  const seen = new Set<string>();
  return txs.filter(tx => {
    const entity = entityMap.get(tx.monitorAddress.address) || tx.monitorAddress.address;
    if (seen.has(entity)) return false;
    seen.add(entity);
    return true;
  });
}
```

**实施要点**：
- Bundle 检测：查询 Jito 历史数据，识别经常出现在同一 bundle 中的钱包对
- 资金溯源：对每个监控钱包追溯 3 层初始 SOL 来源
- 关联置信度 > 0.6 的钱包对合并为一个共识实体
- 每周全量扫描一次，增量检测实时运行

---

### 8.3 时间止损 + 停滞退出

**问题**：原方案只有价格维度的止损，缺少时间维度。在 meme 币市场，30 秒不创新高就可能意味着失败。

```typescript
// 增强: src/modules/price-monitor/price-monitor.service.ts

interface PositionMonitor {
  mint: string;
  entryPrice: number;
  entryTime: number;           // 入场时间戳
  highestPrice: number;        // 持仓期间最高价
  highestPriceTime: number;    // 最高价出现时间
  lastAthTime: number;         // 最后一次创 ATH 的时间
}

// ===== 停滞退出规则 =====
function checkStagnationExit(pos: PositionMonitor, now: number): SellSignal | null {
  const timeSinceAth = now - pos.lastAthTime;
  const priceChangeFromAth = (pos.currentPrice - pos.highestPrice) / pos.highestPrice;
  
  // 规则 1: 入场后 30 秒内未创新高 → 减仓 50%
  if (now - pos.entryTime > 30_000 && 
      pos.highestPrice <= pos.entryPrice * 1.05) {
    return { action: 'sell', ratio: 0.5, reason: '30s 内未上涨 5%' };
  }
  
  // 规则 2: 入场后 3 分钟仍亏损 → 再减 30%
  // 2026 年 meme 币平均持仓极短，3 分钟不涨说明信号可能失效
  if (now - pos.entryTime > 180_000 && 
      pos.currentPrice < pos.entryPrice &&
      !pos.rule2Triggered) {
    pos.rule2Triggered = true;
    return { action: 'sell', ratio: 0.3, reason: '3min 仍亏损，减仓 30%' };
  }
  
  // 规则 3: 从 ATH 回落 + 超过 60 秒未创新高 → 全部卖出
  if (timeSinceAth > 60_000 && priceChangeFromAth < -0.15) {
    return { action: 'sell', ratio: 1.0, reason: '60s 未创新高且从高点回撤 15%' };
  }
  
  // 规则 4: 跟单的聪明钱已卖出 50%+ → 立即减仓
  if (pos.sourceWalletSellRatio >= 0.5) {
    return { action: 'sell', ratio: 0.7, reason: '跟单对象已卖出 50%+' };
  }
  
  // 规则 5: 持仓超过 5 分钟且亏损 → 清仓 【v2.1: 从 10min 收紧至 5min】
  // 经过 30s(-50%) 和 3min(-30%) 后剩余仓位仅约 20%
  // 这 20% 尾仓不值得再等 10 分钟，5 分钟已是充足的恢复窗口
  if (now - pos.entryTime > 300_000 && pos.currentPrice < pos.entryPrice) {
    return { action: 'sell', ratio: 1.0, reason: '持仓超 5min 且亏损，强制清仓' };
  }
  
  // 规则 6: 持仓超过 24 小时（盈利中）→ 减半
  // 即使盈利，超长持仓也要收缩风险敞口
  if (now - pos.entryTime > 86400_000) {
    return { action: 'sell', ratio: 0.5, reason: '持仓超 24h，减半收缩风险' };
  }
  
  return null;
}
```

**价格监控频率**：
- 入场后 0-5 分钟：每 2 秒检查一次（gRPC 实时流）
- 5-60 分钟：每 10 秒检查一次
- 1 小时后：每 30 秒检查一次
- 这样在关键时期保持高频，长期持仓降低资源消耗

---

### 8.4 资金分散化与仓位管理

**问题**：原方案没有资金分配策略，所有跟单用同一笔资金，单一钱包失效可能导致全部亏损。

```typescript
// 新增: src/modules/position-manager/fund-allocator.ts

interface FundAllocationConfig {
  totalBudgetSol: number;         // 总预算 (SOL)
  maxSingleTradeSol: number;      // 单笔最大交易金额
  maxSingleTokenExposure: number; // 单一代币最大持仓占比 (0-1)
  maxConcurrentPositions: number; // 最大同时持仓数量
  minTradeAmount: number;         // 最小交易金额 (低于此不划算)
  
  // 按共识强度动态分仓
  allocationTiers: {
    consensusScore: number;       // 最低共识分数
    allocRatio: number;           // 分配比例
  }[];
}

// 示例配置：总预算 10 SOL
const defaultConfig: FundAllocationConfig = {
  totalBudgetSol: 10,
  maxSingleTradeSol: 1,           // 单笔最多 1 SOL (总预算 10%)
  maxSingleTokenExposure: 0.2,    // 单个代币最多占总资金 20%
  maxConcurrentPositions: 15,     // 最多同时持有 15 个代币
  minTradeAmount: 0.05,           // 低于 0.05 SOL 不交易（手续费不划算）
  
  allocationTiers: [
    { consensusScore: 10, allocRatio: 1.0 },   // 超强共识 → 满配 1 SOL
    { consensusScore: 6,  allocRatio: 0.5 },   // 强共识 → 0.5 SOL
    { consensusScore: 4,  allocRatio: 0.2 },   // 一般共识 → 0.2 SOL
  ],
};

function calculateTradeAmount(
  signal: ConsensusSignal, 
  config: FundAllocationConfig,
  currentPositions: Position[]
): number | null {
  // 检查 1：是否超出最大持仓数量
  if (currentPositions.length >= config.maxConcurrentPositions) {
    return null; // 不开新仓
  }
  
  // 检查 2：计算可用资金
  const usedSol = currentPositions.reduce((sum, p) => sum + p.entryAmountSol, 0);
  const availableSol = config.totalBudgetSol - usedSol;
  
  // 检查 3：按共识强度分配金额
  let allocRatio = 0;
  for (const tier of config.allocationTiers) {
    if (signal.weightedConsensus >= tier.consensusScore) {
      allocRatio = tier.allocRatio;
      break;
    }
  }
  
  const tradeAmount = Math.min(
    config.maxSingleTradeSol * allocRatio,
    availableSol,
    config.totalBudgetSol * config.maxSingleTokenExposure
  );
  
  // 检查 4：是否高于最小交易金额（否则手续费不划算）
  if (tradeAmount < config.minTradeAmount) {
    return null;
  }
  
  return tradeAmount;
}
```

**最低资金要求分析**：

| 项目 | 费用 |
|------|------|
| Jito Tip (每笔) | 0.00001-0.0001 SOL |
| Solana 交易费 (每笔) | ~0.000005 SOL |
| Jupiter 无额外费用 | 0 |
| 滑点损耗 (平均) | ~3-5% 的交易金额 |
| **单笔最低盈亏平衡金额** | **~0.05 SOL** |

**结论**：低于 0.05 SOL 的单笔交易不划算（固定费用占比太高）。建议**最低总预算 5 SOL**，每笔 0.1-1 SOL。

---

### 8.5 入场价偏移监控 (Slippage Budget)

**问题**：跟单者比聪明钱晚几个区块入场，可能买贵 10-30%。

```typescript
// 新增: 在交易执行前检查入场价偏移

async function checkEntryPriceDeviation(
  signal: ConsensusSignal,
  currentQuote: JupiterQuote
): Promise<{ proceed: boolean; reason?: string }> {
  
  // 聪明钱的平均买入价
  const smartMoneyAvgPrice = signal.avgEntryPriceUsd;
  
  // 我们当前能拿到的价格（Jupiter quote）
  const ourEntryPrice = calculatePriceFromQuote(currentQuote);
  
  // 价格偏移
  const deviation = (ourEntryPrice - smartMoneyAvgPrice) / smartMoneyAvgPrice;
  
  // 偏移 > 15% → 放弃跟单
  if (deviation > 0.15) {
    return { 
      proceed: false, 
      reason: `入场价偏移 ${(deviation*100).toFixed(1)}% > 15% 阈值，放弃跟单` 
    };
  }
  
  // 偏移 5-15% → 减小仓位
  if (deviation > 0.05) {
    signal.adjustedAllocRatio = signal.allocRatio * (1 - deviation);
    return { proceed: true, reason: `入场价偏移 ${(deviation*100).toFixed(1)}%，仓位缩减` };
  }
  
  // 偏移 < 5% → 正常跟单
  return { proceed: true };
}
```

**偏移监控仪表盘指标**：
- 平均入场偏移 (%)：目标 < 5%
- 因偏移放弃的交易比例：预期 20-40%
- 偏移过大说明延迟还需优化或信号太热

---

### 8.6 量化 KPI 体系

**原方案缺少明确的可度量指标。以下是第一梯队应达到的 KPI：**

```
┌────────────────────────────────────────────────────────────┐
│                     系统健康 KPI 仪表盘                      │
├──────────────────┬──────────┬──────────┬──────────────────┤
│       指标        │  最低标准  │   目标   │     你当前       │
├──────────────────┼──────────┼──────────┼──────────────────┤
│ 信号→交易延迟     │  < 3s    │  < 1s    │  5-30s ❌       │
│ 虚假信号过滤率    │  > 80%   │  > 90%   │  ~10% ❌        │
│ Rug Pull 拦截率   │  > 90%   │  > 95%   │  0% ❌          │
│ 入场价偏移 (中位)  │  < 10%   │  < 5%    │  未知 ❌        │
│ 30日胜率          │  > 30%   │  > 45%   │  <10% ❌        │
│ 单笔最大亏损      │  < 50%   │  < 30%   │  100% ❌        │
│ 月度总收益率      │  > 0%    │  > 20%   │  负 ❌           │
│ 系统可用率        │  > 99%   │  > 99.5% │  未部署 ❌       │
│ 地址池活跃率      │  > 60%   │  > 80%   │  ~0% ❌（过期） │
│ 跟卖触发率        │  > 70%   │  > 90%   │  0%（无跟卖）❌ │
└──────────────────┴──────────┴──────────┴──────────────────┘
```

**KPI 实现**：在 ClickHouse 中建立统计视图，每日自动生成报告推送到 Telegram。

---

### 8.7 更新后的实施计划

原 Phase 1-4 保持不变，新增 **Phase 5**：

### Phase 5：反操纵与量化管控（第 9-10 周）

| 任务 | 工作量 | 对应问题 |
|------|--------|---------|
| Wash Trading 检测 (关联钱包识别) | 3 天 | §8.2 |
| 退出流动性陷阱检测 | 2 天 | §8.1 |
| 时间止损 + 停滞退出 | 2 天 | §8.3 |
| 资金分散化 + 仓位管理器 | 3 天 | §8.4 |
| 入场价偏移监控 | 1 天 | §8.5 |
| KPI 仪表盘 (ClickHouse 视图 + TG 推送) | 2 天 | §8.6 |
| **总计** | **~13 天** | |

### 更新后的完整时间线

| 阶段 | 时间 | 目标 |
|------|------|------|
| Phase 1 | 第 1-2 周 | 能跑（Jito + Jupiter V2 + 基础止损 + Anti-rug + **Token-2022 检测**） |
| Phase 2 | 第 3-4 周 | 够快（Yellowstone gRPC + 跟卖） |
| Phase 3 | 第 5-6 周 | 够准（钱包评分 + **质量门槛** + 加权共识 + 高级过滤） |
| Phase 4 | 第 7-8 周 | 够稳（跟踪止损 + 分批止盈 + **收紧时间止损至 5min**） |
| Phase 5 | 第 9-10 周 | 够强（反操纵 + 资金分散 + KPI 度量） |
| Phase 6 | 第 11-12 周 | 前瞻（AI Agent 信号通道，探索性） |
| **总计** | **~12 周** | **第一梯队 + 前瞻布局** |

---

### Phase 6：AI 代理经济探索（第 11-12 周） — 前瞻性布局

> 2026 年链上 AI Agent 活跃度持续增长（elizaOS、Virtuals、RIG 等框架），
> 部分爆发性 Meme 由 AI Agent 自主发起或早期参与。
> 本阶段为探索性质，独立于主策略运行。

| 任务 | 工作量 | 说明 |
|------|--------|------|
| AI Agent 钱包识别与跟踪 | 3 天 | 通过 Agent Registry + 链上特征识别 elizaOS/RIG/TAI 等框架关联钱包 |
| 独立信号通道搭建 | 3 天 | AI Agent 信号不混入人类聪明钱共识模型，单独评估 |
| AI Agent 行为模式分析 | 2 天 | 建立 AI Agent 特有的评分维度（与人类不同） |
| 小额实验验证 | 持续 | 0.1 SOL 跑 2 周，验证是否有 alpha |
| Jito ShredStream 评估 | 2 天 | 评估 raw shred 解析的工程成本与入场偏移改善幅度，决定是否值得投入 |
| **总计** | **~10 天** | |

**注意**：AI Agent 信号是辅助参考，不应并入主共识模型：
- AI Agent 交易模式与人类聪明钱完全不同（超高频、小额、叙事驱动）
- AI Agent 地址不稳定，经常更换
- 作为独立的"第二信号源"，当 AI 信号与人类共识重合时可加大仓位

**关于 ShredStream 的评估备注**：
- ShredStream 可提前 200-500ms 获取原始区块碎片，理论上可在共识触发后加速 Bundle 排序
- 但我们的策略入场已晚 30-90s，200ms 的边际改善对入场偏移影响约 <1%
- 工程成本高（需 Rust 底层解析 raw shreds，约 2-3 周开发），ROI 待验证
- 先做 2 天评估，有数据支撑后再决定是否正式开发
