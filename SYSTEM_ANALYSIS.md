# 系统分析：链上自动化交易平台

> 基于全部源码的深度分析

---

## 一、系统定位

这是一个**多链加密货币自动化交易 + 钱包管理平台**，由 UniPass 团队开发，覆盖以下核心业务：

1. **Solana DEX 自动跟单交易**（核心盈利模块）
2. **CKB UTXO DEX 撮合引擎**（自建去中心化交易所）
3. **智能合约钱包**（社交恢复 + 无私钥登录）
4. **跨链桥 + 支付网关**
5. **社交交易 / Telegram Bot / 社区工具**

平台不是面向散户的简单交易界面，而是一个**有自动策略引擎、链上数据分析、KOL 跟单、MEV 保护**的专业级交易基础设施。

---

## 二、核心业务模块详解

### 2.1 Solana DEX 自动交易引擎 ⭐（最核心）

**对应服务**: `dexauto-server` (NestJS) + `dexauto-trading-server` (Rust) + `dexauto-data-center` (Go)

#### 工作流程

```
  Solana 区块链
       │
       ├── dexauto-data-center (Substreams)
       │   └── 实时抓取所有 DEX 交易 → ClickHouse
       │
       ├── TransferSubscriber (WebSocket)
       │   └── 监听指定钱包地址的链上转账
       │
       ▼
  dexauto-server (策略引擎)
       │
       ├── 🔍 Token 分析：热门代币、池子流动性、K线、持仓分布
       ├── 📊 KOL 跟单：监控 KOL 地址，复制交易
       ├── 🤖 自动策略：条件触发买入/卖出
       ├── 📱 消息通知：交易信号推送
       │
       ▼
  dexauto-trading-server (Rust 执行器)
       └── 构建+签名+提交 Solana 交易
           ├── MEV 保护 (Jito bribery)
           ├── 优先费设置
           └── 滑点控制
```

#### 功能细节

- **自动跟单 (Automatic Strategy)**
  - 用户设置监控的 KOL 钱包地址（最多 300 个）
  - 系统通过 WebSocket 实时监听这些地址的链上交易
  - 当 KOL 买入某代币时，系统自动跟单买入
  - 支持条件过滤：最低金额、最大滑点、代币黑名单
  - 预设策略模板："KOL 稳健" 等

- **手动交易**
  - 用户通过前端选择代币，设置金额和滑点
  - 后端调用 Rust trading-server 执行链上 swap
  - 支持设置 MEV 保护费（Jito bribery: 默认 0.01 SOL）
  - 支持设置优先费（默认 0.005 SOL）

- **Token 数据分析**（ClickHouse 驱动）
  - 热门代币排行（按交易量/次数）
  - 池子深度和流动性分析
  - 历史价格K线
  - 持仓分析和大户追踪

- **托管钱包 (KMS)**
  - 每个用户生成独立的 Solana/EVM 钱包
  - 私钥通过 AWS KMS 加密存储
  - 用户不直接接触私钥，后端代签交易

---

### 2.2 CKB UTXO DEX（自建去中心化交易所）

**对应服务**: `utxo-swap-sequencer` (Rust) + `utxoswap-farm-sequencer` (Rust) + `utxoswap-paymaster-backend` (NestJS) + `huehub-dex-backend` (NestJS)

#### 架构

```
  CKB 区块链 (UTXO 模型)
       │
       ▼
  utxo-swap-sequencer (Rust)
       ├── 订单簿管理
       ├── UTXO 交易构建
       ├── 链上交易撮合
       └── 流动性池管理
       │
  utxoswap-farm-sequencer (Rust)
       └── 流动性挖矿奖励计算和分发
       │
  utxoswap-paymaster-backend (NestJS)
       └── Gas 代付 (用户无需持有 CKB 即可交易)
       │
  huehub-dex-backend (NestJS)
       ├── RGB++ / DOBS 数字对象交易
       ├── NFT 市场
       ├── Launchpad (新代币发行)
       └── BTC/CKB 资产管理
```

这是一个完整的 **CKB 链上去中心化交易所**，类似 Uniswap 但基于 UTXO 模型，并扩展了 RGB++ 协议支持（比特币生态的 CKB 二层资产）。

---

### 2.3 UniPass 智能合约钱包

**对应服务**: `unipass-wallet-backend` + `unipass-wallet-oauth` + `unipass-wallet-relayer` + `unipass-snap-service` + `unipass-cms-backend`

#### 核心特点

- **无私钥登录**: 通过 Email/Google/Apple OAuth 创建和恢复钱包
- **智能合约账户**: ERC-4337 兼容的合约钱包，不是 EOA
- **社交恢复**: 设置 Guardian 地址，丢失密钥可通过社交验证恢复
- **Gas-less 交易**: Relayer 代付 Gas，用户无需 ETH
- **MetaMask Snap**: 集成到 MetaMask 作为 Snap 插件
- **TSS 门限签名**: 多方计算签名，私钥不在单点存储

#### 数据模型

```
Account → Keys (多密钥管理)
       → Authenticators (OAuth 认证器)
       → Recovery (社交恢复配置)
       → Cloud Key (云端备份密钥)
```

---

### 2.4 跨链桥 + 支付

**对应服务**: `unipass-bridge-validator` (Rust) + `payment-server` (Rust)

- **跨链桥**: CKB ↔ Ethereum 跨链资产转移，验证器节点负责验证跨链交易的合法性
- **支付网关**: 法币入金，支持信用卡/Apple Pay → 加密货币的购买流程

---

### 2.5 社交交易 + Telegram Bot

**对应服务**: `solagram-backend` + `opentg-backend`

- **Solagram**: Solana 社交交易平台
  - Solana Blink 链接（可分享的交易链接）
  - Telegram Bot 集成
  - 交易信号推送和跟单
  - 短链接生成和追踪

- **OpenTG Bot**: Telegram 社群管理机器人
  - 积分系统
  - 社群互动
  - Blink 链接管理

---

### 2.6 盲盒活动

**对应服务**: `mystery-bomb-box-backend`

- 链上盲盒/抽奖活动系统
- Blink 链接分发
- 交易追踪

---

## 三、支持的区块链

| 链 | 用途 | 相关服务 |
|----|------|----------|
| **Solana** | DEX 自动交易 (主战场) | dexauto-server, trading-server, solagram |
| **CKB (Nervos)** | UTXO DEX + RGB++ | utxo-swap-sequencer, huehub-dex-backend |
| **Ethereum** | 智能合约钱包 + 跨链桥 | wallet-backend, bridge-validator, snap-service |
| **Bitcoin** | RGB++ 资产 (通过 CKB) | btc-assets-api, huehub-dex-dobs-backend |
| **Arbitrum** | (合约代码中有引用) | snap-service (arb_gas_info.rs) |

---

## 四、数据流向

```
  ┌──────────────────────────────────────────────────────────┐
  │                    用户终端                               │
  │  Web前端 / Telegram Bot / MetaMask Snap                  │
  └────────────────────┬─────────────────────────────────────┘
                       │ HTTPS / WebSocket
                       ▼
  ┌────────────────────────────────────────────────────────────┐
  │  Nginx 反向代理                                            │
  │  /api/dexauto → dexauto-server                            │
  │  /api/trading → trading-server                            │
  │  /api/huehub  → huehub-dex-backend                        │
  │  /api/utxo    → utxo-swap-sequencer                       │
  └────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
  ┌──────────┐  ┌──────────┐    ┌──────────────┐
  │ 策略引擎  │  │ 交易执行  │    │  钱包管理     │
  │ NestJS   │  │  Rust    │    │  NestJS      │
  │          │  │          │    │              │
  │ 跟单策略  │  │ Swap 构建 │    │ OAuth 登录   │
  │ Token 分析│  │ 签名提交  │    │ 密钥管理     │
  │ 通知推送  │  │ MEV 保护  │    │ 社交恢复     │
  └────┬─────┘  └────┬─────┘    └──────┬───────┘
       │             │                 │
       ▼             ▼                 ▼
  ┌──────────────────────────────────────────────┐
  │               存储层                          │
  │                                              │
  │  PostgreSQL ─ 交易订单, 用户, 策略, 钱包      │
  │  MySQL      ─ DEX 数据, CMS, 钱包账户        │
  │  ClickHouse ─ 链上交易分析数据 (TB级)         │
  │  Redis      ─ 缓存, 分布式锁, 会话, 队列      │
  └──────────────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────────────┐
  │           区块链交互                           │
  │                                              │
  │  Solana RPC  ─ Helius (交易提交+WebSocket)    │
  │  CKB RPC     ─ 全节点 (UTXO 查询+交易提交)    │
  │  Ethereum RPC─ 合约调用 (钱包+跨链桥)          │
  │  Jito        ─ MEV 保护 (Bundle 提交)         │
  └──────────────────────────────────────────────┘
```

---

## 五、商业模式推断

基于代码分析推断出的盈利模式：

1. **交易手续费**: 每笔自动交易抽取一定比例的手续费
2. **Gas 代付差价**: Paymaster 服务收取高于实际 Gas 的费用
3. **跟单订阅**: KOL 跟单策略可能是付费功能（有用户等级和配额限制）
4. **DEX 交易费**: UTXO DEX 的 LP 手续费抽成
5. **Launchpad**: 新代币发行平台收取上币费
6. **法币入金**: 支付网关的汇率差价

---

## 六、技术亮点

1. **Rust 高性能交易执行**: 链上交易构建和提交用 Rust 实现，确保低延迟
2. **实时链上数据管道**: Substreams → ClickHouse，支持 TB 级交易数据分析
3. **WebSocket 实时监听**: 监控 KOL 链上活动，毫秒级响应
4. **分布式锁 (Redlock)**: 保证跟单交易不重复执行
5. **KMS 密钥管理**: 用户私钥不在服务器明文存储
6. **ERC-4337 合约钱包**: 智能合约账户，支持批量交易和社交恢复
7. **RGB++ 跨链**: 比特币资产通过 CKB 进行 DeFi 操作

---

## 七、系统规模

| 指标 | 数量 |
|------|------|
| 后端服务总数 | 22+ |
| Rust 源码文件 | 470+ .rs |
| TypeScript 源码文件 | 1110+ .ts |
| 数据库 | 5 个 (2 PG + 2 MySQL + 1 ClickHouse) |
| 支持的区块链 | 4 条 (Solana, CKB, Ethereum, Bitcoin) |
| API 端点 | 100+ |
| 前端站点 | 14 个 |
| Docker 服务 | 22 个 (含基础设施) |

这是一个**中大型 Web3 项目**，团队规模估计在 10-20 人，开发周期约 2-3 年。
