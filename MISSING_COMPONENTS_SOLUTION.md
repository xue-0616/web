# 缺失组件解决方案

> 针对无法直接获取源码的 3 类组件

---

## 1. unipass-snap-service (Rust binary)

### 现状
- 仅有编译后 ELF binary（8.7MB, with debug_info, not stripped）
- Harbor 所有分支（12个）均为最终 binary，无源码层
- GitHub UniPassID 组织无对应后端仓库

### 解决方案: **从 binary 逆向重写**

已从 binary 中提取到完整信息（见 `REVERSE_ENGINEERING.md`）：

- **项目结构**: 6 个 Rust crate（api, api-utils, daos-snap, snap-common, snap-contract, snap-server）
- **API 路由**: 6 个端点（login, get_free_quota, authorize/verify/get_single_transaction_fee, callback）
- **数据库**: 2 张 MySQL 表（snap_account, snap_account_transaction）含完整字段定义
- **技术栈**: actix-web 4 + sqlx + deadpool-redis + ethers-rs
- **业务逻辑**: 错误类型、Redis 缓存 key 模式、CoinMarketCap 价格查询

**可行性: 高** — 信息足够重写一个功能等价的服务，预计 3-5 天工作量。

### 备选方案
- **方案 A**: 直接运行现有 binary（`./snap-server`），配好 MySQL/Redis/环境变量即可
- **方案 B**: 用 TypeScript 重写（已有相同项目其他 NestJS 服务的模式可参考）
- **方案 C**: 如果暂时不需要 Snap 功能，可跳过此服务

---

## 2. dexauto-data-center (Go Substreams)

### 现状
- Go 编译的 `substreams-sink-sql` binary + `.spkg` Substreams 模块包
- 功能: 将 Solana DEX 交易数据流式写入 ClickHouse

### 解决方案: **使用开源工具 + 自定义 .spkg**

`substreams-sink-sql` 是 **StreamingFast 开源工具** (github.com/streamingfast/substreams-sink-sql)，不需要源码！

#### 重建步骤

1. **安装官方 substreams-sink-sql**:
   ```bash
   # 从 GitHub Releases 下载最新版
   curl -L https://github.com/streamingfast/substreams-sink-sql/releases/latest/download/substreams-sink-sql_linux_x86_64 -o substreams-sink-sql
   chmod +x substreams-sink-sql
   ```

2. **ClickHouse Schema**（从 dexauto-server 查询代码逆向推导）:
   - `dex_trades` — DEX 交易记录（tx_id, signer, base_amount, quote_amount, usd_value, block_time）
   - `trades_1m_stats` — 1分钟统计（base_mint, pool_address, trade_count, buy_count, sell_count, total_volume）
   - `mv_pool_prices` — 池子价格物化视图（pool_address, base_mint, quote_mint, latest_price, base/quote_vault_balance）

3. **使用现有 .spkg 文件** 或基于开源 Solana DEX Substreams 模板创建:
   - 参考: `tl-solana-dex-trades-extended-1-0-1-v1.0.1.spkg`（已在 Harbor 镜像中）
   - 或使用 TopLedger 开源方案: github.com/streamingfast/substreams → docs/tutorials/solana/dex-trades

4. **运行**:
   ```bash
   export DSN="clickhouse://default:@clickhouse:9000/default"
   substreams-sink-sql run "$DSN" ./tl-solana-dex-trades-extended-1-0-1-v1.0.1.spkg
   ```

**可行性: 高** — 核心工具是开源的，只需配置 ClickHouse schema 和 .spkg 模块。

---

## 3. 前端站点 (10个, 仅 webpack/vite 构建产物)

### 现状
| 站点 | 类型 | 文件数 |
|------|------|--------|
| unipass-app-h5 | JS bundle | 103 |
| unipass-cms-frontend | JS bundle | 256 |
| unipass-payment-web | JS bundle | 63 |
| unipass-snap-frontend | JS bundle | 153 |
| solagram-web-site | JS bundle | 37 |
| utxo-swap-site | Static + JS | 15 |
| huehub-dex-site | Static + JS | 15 |
| unipass-wallet-frontend | Vue bundle | 2 |
| unipass-wallet-official-website | Static | 73 |
| bomb-fun-site | Vite bundle | 5 |

### 解决方案

#### 方案 A: 直接部署构建产物（推荐, 0 成本）

所有前端构建产物**功能完整**，可直接用 Nginx 托管：

```nginx
server {
    listen 80;
    server_name dex.example.com;
    root /opt/frontend/utxo-swap-site;
    try_files $uri $uri/ /index.html;
}
```

**适用**: 不需要修改前端的场景

#### 方案 B: 从 GitHub 获取开源部分

以下组件在 GitHub UniPassID 组织有开源代码：

| 本地名称 | GitHub 仓库 | 语言 |
|----------|------------|------|
| unipass-snap-frontend | UniPassID/UniPass-Snap (packages/) | TypeScript |
| unipass-wallet-js (SDK) | UniPassID/UniPass-Wallet-JS | TypeScript |
| unipass-wallet-frontend | UniPassID/UniPass-Wallet-Snap (up-frontend/) | TypeScript |

```bash
git clone https://github.com/UniPassID/UniPass-Snap.git
git clone https://github.com/UniPassID/UniPass-Wallet-JS.git
```

#### 方案 C: 核心交易前端重写

如果需要修改的前端只有交易相关的（DEX 和自动交易），仅需重写 2 个：

1. **utxo-swap-site** — CKB DEX 交易界面
2. **auto-dex-site** — Solana 自动交易界面（已有 15 个 .tsx 源文件）

其余 UniPass 钱包相关前端可直接用现有构建产物或 GitHub 开源版本。

**建议优先级**:
1. 先用方案 A 部署全部前端（立即可用）
2. 从 GitHub 拉取方案 B 的开源代码备用
3. 仅在需要修改时按方案 C 重写具体站点

---

## 总结优先级

| 组件 | 方案 | 预计工时 | 必要性 |
|------|------|----------|--------|
| dexauto-data-center | 开源工具 + ClickHouse schema | 1-2 天 | **高** — 交易数据源 |
| 前端(全部) | 直接 Nginx 部署构建产物 | 0.5 天 | **高** — 立即可用 |
| unipass-snap-service | 运行现有 binary | 0 天 | 中 — 如需 Snap 功能 |
| unipass-snap-service | 从 binary 逆向重写 Rust | 3-5 天 | 低 — 仅在需修改时 |
| 核心前端重写 | React/Vue 新项目 | 5-10 天/站 | 低 — 仅在需定制时 |
