# 自动交易逻辑适用性分析

> 基于 dexauto-server + dexauto-trading-server + dexauto-data-center 完整源码审查
> 分析日期: 2026-04-12

---

## 一、交易逻辑总结

### 完整交易链路

```
 1. 链上数据采集
    dexauto-data-center (Substreams) → ClickHouse
    实时写入: dex_trades / trades_1m_stats / mv_pool_prices

 2. 策略监听
    TransferSubscriberService → WebSocket 连接 data-center
    ├── subscribeNativeTransfers(钱包地址列表)  SOL 转账
    ├── subscribeTokenTransfers(钱包地址列表)   SPL Token 转账
    └── subscribeAccountDexTrades(KOL地址列表)  DEX 交易

 3. 策略触发
    AutomaticStrategyExecutor 接收到 KOL 的 DEX 交易事件:
    ├── 检查触发条件 (TriggerItem)
    │   ├── PurchaseAddrUpper: 购买该 Token 的地址数 > N
    │   ├── PurchaseSolUpper: 购买金额 > N SOL
    │   └── PurchaseAddrAndSolUpper: 地址数 AND 金额同时满足
    ├── 过滤: BANNED_TOKENS 黑名单 (JUP/USDC/USDT 等稳定币)
    ├── 过滤: 策略有效期 24 小时、交易时效 2 分钟
    └── 通过 → 发起跟单交易

 4. 交易执行
    TradingClient → Rust trading-server
    ├── 路由选择:
    │   ├── Jupiter 聚合器 (quote → swap API)
    │   └── Raydium AMM V4 直连 (constant-product 计算)
    ├── MEV 保护:
    │   ├── is_anti_mev=true → 通过 NextBlock 提交
    │   └── bribery_amount > 0 → 附加 Jito Tip 指令
    ├── 优先费: compute_unit_price (默认 0.005 SOL)
    └── TxSubmitter → sendTransaction (skipPreflight=true)

 5. 卖出策略
    ├── DoubleSell: 翻倍卖出
    ├── LowerPriceSwap: 低于目标价卖出 (止损)
    └── GreaterPriceSwap: 高于目标价卖出 (止盈)
```

---

## 二、逐项适用性评估

### ✅ 仍然有效 — 可直接使用

| 组件 | 说明 |
|------|------|
| **Jupiter 聚合器** | Jupiter V6 API 仍为 Solana 最主流 DEX 聚合器，API 格式未变 (`/quote` + `/swap`) |
| **Raydium AMM V4** | 恒积公式计算逻辑 (`x * y = k`) 是数学不变式，AMM V4 池仍存在 |
| **Solana RPC** | `sendTransaction` + `getAccountInfo` 是标准 RPC，永不过期 |
| **ClickHouse 分析** | SQL 查询逻辑通用，`dex_trades` 表结构合理 |
| **KOL 跟单逻辑** | 监控地址 → 检测 DEX 交易 → 条件触发 → 跟单，业务逻辑通用 |
| **触发条件** | 地址数/金额阈值过滤，与具体协议无关 |
| **止盈止损** | 限价单逻辑 (GreaterPriceSwap/LowerPriceSwap) 是通用的 |
| **分布式锁 (Redlock)** | 防重复执行，基础设施层，永不过期 |
| **BullMQ 任务队列** | 交易排队执行，基础设施层 |

### ⚠️ 需要更新 — 逻辑正确但实现过时

| 组件 | 问题 | 修改量 |
|------|------|--------|
| **Jito MEV 保护** | 代码用 NextBlock API 而非 Jito Bundle API。Jito 现在主推 `jito-labs/jito-solana` 和 Bundle 提交方式。NextBlock 可能已关闭或更名 | 中 — 替换 TxSubmitter 中的 MEV 提交方式 |
| **Jupiter API URL** | 代码用 `jupiter_url` 环境变量（可能是 `https://quote-api.jup.ag/v6`），Jupiter 已升级到 V6/Ultra，API 基本兼容但有新字段 | 小 — 确认 URL，可能需加 `dynamicSlippage` 等新参数 |
| **Raydium AMM V4 直连** | Raydium 主推 CLMM (集中流动性) 和 CPMM，很多新池已不在 AMM V4。直连 V4 会错过大量交易对 | 大 — 需增加 Raydium CLMM 支持，或全部走 Jupiter 聚合 |
| **Solana SDK v2** | solana-sdk 2.x 是较新版本，但 Solana 交易格式从 Legacy 到 Versioned Transaction 已是标准。代码用 `skipPreflight: true` 直接提交，需确认是否支持 Versioned TX | 小 — 检查交易序列化格式 |
| **chain.fm** | 代码通过 `https://chain.fm/api/trpc` 获取 KOL 频道信息。chain.fm 是第三方服务，可能已关闭或 API 变更 | 中 — 如 chain.fm 不可用，需替换为其他 KOL 追踪数据源 |
| **Substreams .spkg** | `tl-solana-dex-trades-extended-1-0-1-v1.0.1.spkg` 可能需更新到支持最新 DEX 协议的版本 (Pump.fun, Orca Whirlpool, Meteora 等) | 中 — 从 TopLedger 获取最新 .spkg |
| **BANNED_TOKENS 列表** | 黑名单只有 12 个代币，缺少新的稳定币和常见 wrap 代币 | 小 — 补充列表 |

### ❌ 缺失 — 需要新增

| 功能 | 原因 | 重要性 |
|------|------|--------|
| **Pump.fun 支持** | 2024-2025 年 Solana 上 80%+ 新 meme coin 通过 Pump.fun 发行。代码完全没有 Pump.fun bonding curve 逻辑 | **关键** — 不加这个，跟单 meme 币几乎无法成交 |
| **Meteora DLMM** | Meteora 已成为 Solana 第二大 DEX，很多池不在 Raydium。代码无 Meteora 支持 | 高 |
| **Orca Whirlpool** | Orca 集中流动性池，代码未直连 | 中 — Jupiter 可聚合 |
| **Priority Fee 动态调整** | 代码用固定优先费 (0.005 SOL)。Solana 网络拥堵时需动态调整，否则交易失败率很高 | 高 |
| **Compute Budget 优化** | 代码简单估算 CU (`200k + 100k * N`)。实际需要 `simulateTransaction` 后精确设置 | 中 |
| **Token 2022 支持** | 新代币可能用 Token-2022 标准（有 transfer fee, interest-bearing 等），代码只处理 SPL Token | 中 |
| **Anti-Rug 检测** | 跟单 meme 币风险极高，缺少代币合约安全检查（可铸造、可冻结、黑名单等） | **关键** — 不加会亏钱 |

---

## 三、核心结论

### 自动交易逻辑框架是好的，但针对 2026 年 Solana 生态已经落后

**整体架构评分: 7/10** — 架构设计合理，模块化清晰，但交易执行层需要显著更新。

| 层级 | 评分 | 说明 |
|------|------|------|
| 数据管道 | 8/10 | Substreams → ClickHouse 架构优秀，只需更新 .spkg 模块 |
| 策略引擎 | 8/10 | KOL 跟单 + 条件触发逻辑通用，不依赖特定协议 |
| 交易路由 | 5/10 | 只支持 Jupiter + Raydium V4，缺 Pump.fun / Meteora / CLMM |
| 交易执行 | 6/10 | 固定优先费 + NextBlock MEV，需改为动态费率 + Jito Bundle |
| 风控 | 3/10 | 基本没有 anti-rug，只有简单的 BANNED_TOKENS 黑名单 |

---

## 四、最小修改方案 (快速恢复可用)

如果目标是**最快恢复自动交易功能**，按以下优先级修改：

### P0 — 必须改 (否则交易基本失败)

1. **交易路由全部走 Jupiter**
   - 删除 Raydium V4 直连逻辑，100% 走 Jupiter 聚合
   - Jupiter 已聚合了 Pump.fun / Raydium / Orca / Meteora 全部
   - 改动: 修改 `swap.rs` 中的路由选择，强制走 Jupiter

2. **更新 Jupiter API**
   - 确认 `jupiter_url` 指向 `https://quote-api.jup.ag/v6` (或 Ultra)
   - 可能需要传 `platformFeeBps` 收取平台手续费

3. **优先费改为动态**
   - 调用 `getRecentPrioritizationFees` RPC 获取当前网络费率
   - 或使用 Helius Priority Fee API

### P1 — 应该改 (提高成功率和安全性)

4. **MEV 保护改用 Jito Bundle**
   - 替换 NextBlock → Jito `sendBundle` API
   - Endpoint: `https://mainnet.block-engine.jito.wtf/api/v1/bundles`

5. **增加 Anti-Rug 检查**
   - 跟单前检查代币: mintAuthority 是否 revoked, freezeAuthority 是否 null
   - 调用 `getAccountInfo` 检查 Mint 账户
   - 可选: 集成 RugCheck API 或 GoPlus API

6. **更新 BANNED_TOKENS**
   - 加入新的稳定币、wrap token
   - 加入已知 scam token

### P2 — 可以后做

7. 增加 Compute Budget 精确估算
8. 支持 Token-2022
9. 添加 Pump.fun bonding curve 直连 (Jupiter 已覆盖，但直连更快)
10. chain.fm 替代方案

---

## 五、风险提示

1. **私钥安全**: 系统用 AWS KMS 加密存储用户私钥，`tx_submitter_private_key` 用于提交交易。这些密钥需要全部重新生成
2. **跟单延迟**: WebSocket 监听 → 策略触发 → Jupiter 报价 → 签名 → 提交，全链路可能 2-5 秒。对 meme 币来说，这个延迟可能导致买入价格远高于 KOL 的买入价
3. **资金风险**: 自动跟单 meme 币风险极高，需要设置严格的单笔限额和日限额
4. **合规风险**: 托管用户私钥并代签交易，在很多司法管辖区可能需要牌照
