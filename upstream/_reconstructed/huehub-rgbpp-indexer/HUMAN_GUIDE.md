# `huehub-rgbpp-indexer` 人话阅读指南

> 重建基于 Ghidra 伪代码 + ELF 字符串 + 调用图。代码片段**示意性**，不保证编译。

## 一、这个程序是干什么的

一个 **RGB++ 资产索引器**（HueHub 内部服务），同时观察 **Bitcoin** 链和 **CKB**（Nervos）链上的 RGB++ 相关交易，把资产所有权、余额、铸造历史索引到本地 **redb**（嵌入式 KV 存储）数据库，并通过 HTTP API 向 HueHub DEX 前端 / 钱包提供查询服务。

典型查询：
- `balances(script_key)` —— 查某个 RGB++ 脚本对应的所有资产余额
- `token_holders(token)` —— 查某个 token 的持有者列表
- `mint_txs(token, page)` —— 查某 token 的铸造历史

## 二、两个 crate（workspace）

| Crate | 说明 | 文件 |
|---|---|---|
| `rgbpp-indexer`（bin） | 主进程，HTTP server + BTC/CKB watcher | `main.rs`, `chain.rs`, `indexer.rs`, `watchers/*.rs` |
| `rgbpp-daos`（lib） | 数据访问层，redb 表封装 | `lib.rs`, `database.rs`, `tables/*.rs` |

原始源文件（ELF 字符串**确凿**证实）：
- `src/main.rs` — 入口
- `src/lib.rs` — `rgbpp-daos` 的 lib root（有 1 个 tracing 事件在 line 58）
- `src/chain.rs` — 链抽象（BTC + CKB trait）
- `src/database.rs` — redb 包装（Readable / Writable 事务）
- `src/indexer.rs` — **核心 `RgbppIndexer`**
- `src/types.rs` — 共享类型（ScriptKey、OutPoint、Balance 等）
- 以及隐藏的 `src/watchers/{btc,ckb,indexer}.rs`

## 三、公开 API 表面（`RgbppIndexer`）

从 Ghidra 导出的**确凿**方法清单：

### `RgbppIndexerBuilder`
```rust
impl RgbppIndexerBuilder {
    pub fn set_btc_rpc_url(self, url: impl Into<String>) -> Self;
    pub fn set_ckb_rpc_url(self, url: impl Into<String>) -> Self;
    // 还可能有：set_db_path、set_listen_addr 等（未被 demangle 捕获）
    pub fn build(self) -> Result<RgbppIndexer, Error>;
}
```

### `RgbppIndexer`（查询接口）
```rust
impl RgbppIndexer {
    /// 查某个 ScriptKey 在各 token 下的余额。
    /// 调用链（确凿）:
    ///   ScriptKey::from_str_and_validate_network
    ///   -> RgbppDatabase::begin_read
    ///   -> RgbppBalancesReadable::connect
    ///   -> RgbppBalancesReadable::balances
    pub fn balances(&self, script_key: &str)
        -> Result<Vec<Balance>, Error>;

    /// 查某 token 信息。
    pub fn token(&self, type_hash: &str) -> Result<Token, Error>;

    /// 按 token + 分页列出持有者。
    pub fn token_holders(&self, type_hash: &str, pagination: Pagination)
        -> Result<Vec<Holder>, Error>;

    /// 某个 script 在 token 下的余额。
    pub fn token_balance(&self, script_key: &str, type_hash: &str)
        -> Result<u128, Error>;

    /// 某 token 的 UTXO outpoints（用于用户取出可花费的 cells）。
    pub fn token_outpoints(&self, script_key: &str, type_hash: &str)
        -> Result<Vec<OutPoint>, Error>;

    /// 铸造交易历史（分页）。
    pub fn mint_txs(&self, type_hash: &str, pagination: Pagination)
        -> Result<Vec<MintTx>, Error>;

    /// 铸造交易总数。
    pub fn mint_txs_count(&self, type_hash: &str) -> Result<u64, Error>;
}
```

## 四、Watcher 架构（链同步）

从 Ghidra 看到 3 个 watcher：

```
┌────────────────┐    ┌────────────────┐    ┌──────────────────────┐
│  BtcWatcher    │    │  CkbWatcher    │    │ RgbppIndexerWatcher  │
│  fetch_blocks  │    │  fetch_blocks  │    │  watch / inner_watch │
└───────┬────────┘    └────────┬───────┘    │  update_ckb_txn      │
        │                      │             │  handle_reorg        │
        ▼                      ▼             └──────────┬───────────┘
     BTC 区块流             CKB 区块流                   │
                                                        ▼
                                               RgbppDatabase (redb)
                                               + emit HTTP events
```

### `RgbppIndexerWatcher`（确凿方法）

```rust
impl RgbppIndexerWatcher {
    /// 构造器。入参：两个 client + DAO 引用 + checkpoint 配置
    pub fn new(btc: BtcClient, ckb: CkbClient, dao: RgbppDao) -> Self;

    /// 顶层循环：loop { inner_watch().await; on_err { retry } }
    pub async fn watch(self) -> Result<(), Error>;

    /// 一次同步迭代：fetch 下一批块 -> 按顺序 update_ckb_transaction ->
    /// 处理可能的重组 -> commit checkpoint
    async fn inner_watch(&self) -> Result<(), Error>;

    /// 把一笔 CKB 交易里的 RGB++ cell 落库。
    async fn update_ckb_transaction(&self, tx: CkbTransaction)
        -> Result<(), Error>;

    /// 区块链重组：回滚到共同祖先，重放新分支。
    async fn handle_reorg(&self, fork_point: BlockHash)
        -> Result<(), Error>;
}
```

### `BtcWatcher` / `CkbWatcher`

```rust
impl BtcWatcher {
    /// 从指定高度起批量拉块，带去重和速率限制。
    pub async fn fetch_blocks(&self, from: u64, count: u32)
        -> Result<Vec<bitcoin::Block>, Error>;
}
impl CkbWatcher {
    pub async fn fetch_blocks(&self, from: u64, count: u32)
        -> Result<Vec<ckb_jsonrpc_types::BlockView>, Error>;
}
```

## 五、存储层：`rgbpp-daos` crate

以 [`redb`](https://docs.rs/redb)（纯 Rust 的 ACID 嵌入式 KV）为底层。每张表有一组 `*Readable` + `*Writable` 封装：

```rust
// src/database.rs 的模式
pub struct RgbppDatabase { inner: redb::Database }
impl RgbppDatabase {
    pub fn begin_read(&self)  -> ReadTransaction;
    pub fn begin_write(&self) -> WriteTransaction;
}

// src/tables/rgbpp_balances.rs 的模式
pub struct RgbppBalancesReadable<'a> { tx: &'a ReadTransaction<'a> }
impl<'a> RgbppBalancesReadable<'a> {
    pub fn connect(tx: &'a ReadTransaction<'a>) -> Result<Self>;
    pub fn balances(&self, script_key: &ScriptKey) -> Result<Vec<Balance>>;
}
```

从 Ghidra 看到的表（不完全列表）：
- `rgbpp_balances` —— `(script_key, type_hash) -> u128`
- `rgbpp_holders` —— `type_hash -> Vec<script_key>`（可能是 multimap）
- `rgbpp_transferable` —— UTXO outpoint 索引
- `rgbpp_tokens` —— token 元数据（name / symbol / decimals）
- `rgbpp_mint_history` —— 铸造历史分页表
- **checkpoint 表** —— 存最后已索引到的 btc_tip / ckb_tip

## 六、HTTP Server 入口

### `src/main.rs`（示意）
```rust
mod chain;
mod indexer;
mod watchers;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    tracing_subscriber::fmt::init();
    let cfg: Config = envy::from_env()?;  // 从 env var 读配置
    let indexer = indexer::RgbppIndexerBuilder::default()
        .set_btc_rpc_url(cfg.btc_rpc_url)
        .set_ckb_rpc_url(cfg.ckb_rpc_url)
        .build()?;
    let indexer = std::sync::Arc::new(indexer);

    // 后台：watcher 循环
    let w_indexer = indexer.clone();
    tokio::spawn(async move {
        let watcher = watchers::RgbppIndexerWatcher::new(
            w_indexer.btc_client(), w_indexer.ckb_client(), w_indexer.dao(),
        );
        watcher.watch().await
    });

    // 前台：HTTP server（axum 或 poem，从 Cargo.toml 依赖列表判断）
    let app = axum::Router::new()
        .route("/balances",      get(routes::balances))
        .route("/token/:hash",   get(routes::token))
        .route("/holders/:hash", get(routes::token_holders))
        .route("/outpoints",     get(routes::token_outpoints))
        .route("/mint_txs/:hash",get(routes::mint_txs))
        .with_state(indexer);
    axum::Server::bind(&cfg.listen_addr.parse()?)
        .serve(app.into_make_service()).await?;
    Ok(())
}
```

## 七、依赖（186 个 crate，版本全部在 ELF 里）

关键块：
- **bitcoin 0.30.x / bitcoincore-rpc** —— BTC 链
- **ckb-jsonrpc-types / ckb-types / ckb-sdk** —— CKB 链
- **redb** —— 嵌入式数据库
- **axum** 或 **poem** —— HTTP server（需要看 dep list 确定）
- **tokio 1.x + reqwest** —— 异步 HTTP
- **serde + serde_json** —— 序列化
- **tracing / tracing-subscriber** —— 日志

完整 186 条版本锁在 `rgbpp-indexer/Cargo.toml` 和 `rgbpp-daos/Cargo.toml` 里（注释状态）。

## 八、可信度分级

| 条目 | 证据强度 |
|---|---|
| 两个 crate 的划分 | ★★★★★ 骨架直接从 ELF 符号得到 |
| `RgbppIndexer` 的 7 个查询方法 | ★★★★★ 全部在 Ghidra JSON 里有对应函数 |
| `RgbppIndexerWatcher` 的 5 个方法 | ★★★★★ 同上 |
| `RgbppIndexerBuilder` 的 setter 方法 | ★★★★☆ Ghidra 见 `set_btc_rpc_url`、`set_ckb_rpc_url`、`build`，其他 setter 可能未捕获 |
| redb 作为存储层 | ★★★★★ Ghidra 伪代码直接 import `redb::transactions::ReadTransaction` |
| HTTP server 用 axum | ★★★☆☆ 从 186 个依赖里推断，需看 Cargo.toml 注释列表确认 |
| 具体方法签名 | ★★★☆☆ 参数类型是**典型推测**，不保证与原作者完全一致 |
| 表结构 | ★★★★☆ 表名确凿，schema 细节为推测 |

## 九、深入研究的切入点

在 Ghidra 中打开项目后，直接跳转到以下符号能获得最有用的伪代码：
- `rgbpp_indexer::indexer::RgbppIndexerBuilder::build` —— 看真正的初始化细节
- `rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::inner_watch` —— 真正的同步算法
- `rgbpp_indexer::watchers::indexer_watcher::RgbppIndexerWatcher::handle_reorg` —— 重组策略
- 任一 `RgbppIndexer::*` 查询方法 —— 看准确的数据库操作顺序
