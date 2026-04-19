# `trading-tracker` 人话阅读指南

> 重建基于 Ghidra 伪代码 + ELF 字符串 + 调用图。代码片段**示意性**。

## 一、这个程序是干什么的

一个 **Solana 实时交易追踪器** —— 通过 **StreamingFast Substreams** 订阅 Solana 区块流，解析其中 4 种 DEX 协议的交易（**Raydium AMM / Raydium CLMM / Raydium CPMM / Pump.fun**），计算出每个 pool 的实时价格，然后通过 **jsonrpsee JSON-RPC server** 把价格推送给订阅者。

典型订阅者 = HueHub / DexAuto 后端，用来做**链上自动化交易**的"看得到价格"这一半。

### 工作流

```
┌─────────────────────┐  gRPC stream  ┌─────────────────────────┐
│ StreamingFast node  │ ────────────> │ SubstreamsStream::poll  │
│  (Solana substreams)│               │ (futures::Stream impl)  │
└─────────────────────┘               └──────────┬──────────────┘
                                                 │ DexTradesData
                                                 ▼
                                    ┌───────────────────────────┐
                                    │ TokenPriceRunner          │
                                    │  • deal_substream()       │
                                    │  • 按 DEX 路由:           │
                                    │    - RaydiumAmm  parser   │
                                    │    - RaydiumClmm parser   │
                                    │    - RaydiumCpmm parser   │
                                    │    - Pump        parser   │
                                    │  • 维护 PoolPrice 缓存    │
                                    └──────────┬────────────────┘
                                               │ push update
                                               ▼
                                    ┌───────────────────────────┐
                                    │ jsonrpsee RPC:            │
                                    │  add_pool()               │
                                    │  subscribe_token_price()  │
                                    └───────────────────────────┘
```

## 二、原始源文件（ELF 证实）

| 文件 | 用途 | tracing 事件 |
|---|---|---|
| `src/main.rs` | 入口 | - |
| `src/logger.rs` | `setup_logger` —— env_logger/tracing 初始化 | `logger.rs:27` |
| `src/error.rs` | `DexautoTrackerError` 错误枚举 + From→jsonrpsee | - |
| `src/rpc.rs` | JSON-RPC trait + impl | - |
| `src/meta/error.rs` | sub-error 类型（"Error processing Instruction N"）| - |
| `src/middleware/rpc/layer/logger.rs` | RPC 日志中间件 | - |

隐含的 module（通过 `mod` 引入）：
- `src/config.rs` — `TradingTrackerConfig`, `TradingTrackerNode`
- `src/dex_pool/{mod,pump/accounts}.rs` — DexPool 与 Pump BondingCurve
- `src/pb/**/*.rs` — prost 生成的 protobuf 类型（substreams v1 + v2）
- `src/token_price_manager/{mod,runner,substreams,substreams_stream}.rs` — 核心逻辑

## 三、公开 API 表面

### `config::TradingTrackerConfig`
```rust
#[derive(serde::Deserialize)]
pub struct TradingTrackerConfig {
    pub node:   TradingTrackerNode,      // 含 FromStr impl
    pub pools:  Vec<PoolConfig>,          // 初始追踪的 pools
    pub rpc:    RpcBindCfg,               // 0.0.0.0:PORT
    // ...
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct TradingTrackerNode {
    pub endpoint: String,                 // StreamingFast substreams URL
    pub api_key:  Option<String>,
    pub package:  String,                 // .spkg 包名
    pub module:   String,                 // 要订阅的 module 名
}
// ELF 证实：TradingTrackerNode 实现 FromStr（可能允许 "url#pkg@module" 紧凑写法）
impl std::str::FromStr for TradingTrackerNode { /* ... */ }

impl TradingTrackerConfig {
    pub fn new(path: impl AsRef<Path>) -> Result<Self, Error>;  // 读文件
}
```

### `dex_pool`
```rust
pub enum DexKind { RaydiumAmm, RaydiumClmm, RaydiumCpmm, Pump }  // 证实

pub struct DexPool {
    pub kind:   DexKind,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub address: Pubkey,                  // pool 账户
    // + 每种 DEX 所需的附加字段（vaults、bonding_curve 等）
}
impl DexPool { pub fn new(/* ... */) -> Self; }

// Pump.fun 专属：
pub mod pump::accounts {
    #[derive(anchor_lang::AccountDeserialize)]  // 证实
    pub struct BondingCurve {
        pub virtual_token_reserves: u64,
        pub virtual_sol_reserves:   u64,
        pub real_token_reserves:    u64,
        pub real_sol_reserves:      u64,
        pub token_total_supply:     u64,
        pub complete:               bool,
        // discriminator 由 anchor 生成
    }
}
```

### `token_price_manager`（核心）
```rust
pub struct TokenPriceRunner {
    pools:    HashMap<Pubkey, DexPool>,
    prices:   Arc<Mutex<HashMap<Pubkey, PoolPrice>>>,
    endpoint: SubstreamsEndpoint,
    // broadcast 给 RPC 的 channel
    tx:       tokio::sync::broadcast::Sender<PoolPriceUpdate>,
}

impl TokenPriceRunner {
    /// 顶层 loop：从 stream 拉消息，分发给 deal_msg。
    pub async fn deal_substream(&self) -> Result<(), Error>;

    /// 处理一条 BlockScopedData（substreams rpc.v2 的主消息类型）。
    ///   - 解码为 DexTradesData
    ///   - 按 instruction 循环，调对应 DEX parser
    ///   - 更新 PoolPrice 并通过 broadcast 推给订阅者
    async fn deal_msg(&self, msg: substreams::Message) -> Result<(), Error>;
}

#[derive(serde::Serialize)]  // 证实（有 <impl Serialize for PoolPrice>::serialize）
pub struct PoolPrice {
    pub pool:       Pubkey,
    pub price:      rust_decimal::Decimal,   // 或 f64
    pub slot:       u64,
    pub timestamp:  i64,
    pub base_mint:  Pubkey,
    pub quote_mint: Pubkey,
}
```

### `token_price_manager::substreams_stream::SubstreamsStream`（Stream impl）
```rust
pub struct SubstreamsStream {
    endpoint:  SubstreamsEndpoint,
    pkg:       Package,
    cursor:    Option<String>,
    inner:     BoxStream<'static, Response>,
}

impl SubstreamsStream {
    pub fn new(endpoint: SubstreamsEndpoint, pkg: Package,
               cursor: Option<String>) -> Self;
}

impl futures::Stream for SubstreamsStream {       // 证实
    type Item = Result<BlockScopedData, Error>;
    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>)
        -> Poll<Option<Self::Item>> { /* 1) 消费底层 Response
                                          2) 按 variant 路由 */ }
}
```

### `rpc::TradingTrackerServer`（jsonrpsee）
```rust
#[jsonrpsee::proc_macros::rpc(server)]
pub trait TradingTrackerRpcServer {
    /// 动态加入一个 pool 到追踪列表。
    #[method(name = "add_pool")]
    async fn add_pool(&self, pool: PoolSpec) -> RpcResult<()>;

    /// 订阅某 token 的价格流（WS subscription）。
    #[subscription(name = "subscribe_token_price", item = PoolPrice)]
    async fn subscribe_token_price(&self, mint: Pubkey) -> SubscriptionResult;
}

pub struct TradingTrackerServer {
    runner: Arc<TokenPriceRunner>,
}

impl TradingTrackerRpcServer for TradingTrackerServer { /* ... */ }
impl TradingTrackerServer { pub fn into_rpc(self) -> RpcModule<Self>; }
```

### `error::DexautoTrackerError`（错误）
```rust
#[derive(thiserror::Error, Debug)]
pub enum DexautoTrackerError {
    #[error("Error processing Instruction {0}")]   // 证实（rodata）
    InstructionProcessing(usize),

    #[error("unknown trade instruction")]          // 证实
    UnknownInstruction,

    #[error("Unknown Error: {0}")]                 // 证实
    Unknown(String),

    // + Raydium/Pump 专属错误、substreams 错误、RPC 错误…
}

// 证实：到 jsonrpsee 的 From 实现
impl From<DexautoTrackerError> for jsonrpsee_types::ErrorObject<'static> {
    fn from(e: DexautoTrackerError) -> Self { /* 按类型映射到 code + data */ }
}
```

## 四、`src/main.rs` 大致结构

```rust
mod config; mod dex_pool; mod error; mod logger;
mod pb;     mod rpc;      mod token_price_manager;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    logger::setup_logger();                                   // logger.rs:27

    let cfg = config::TradingTrackerConfig::new("./config.toml")?;
    let endpoint = token_price_manager::substreams::
        SubstreamsEndpoint::new(cfg.node.endpoint.clone(),
                                cfg.node.api_key.clone()).await?;

    let runner = Arc::new(TokenPriceRunner::new(endpoint, cfg.pools.clone()));

    // 后台：substreams loop
    let bg = runner.clone();
    tokio::spawn(async move { bg.deal_substream().await });

    // 前台：jsonrpsee server
    let server = jsonrpsee::server::ServerBuilder::default()
        .build(&cfg.rpc.listen_addr).await?;
    let rpc_module = rpc::TradingTrackerServer::new(runner).into_rpc();
    let handle = server.start(rpc_module);
    handle.stopped().await;
    Ok(())
}
```

## 五、依赖（99 条，ELF 证实版本）

核心：
- **`substreams-sink-rust`** / **`prost`** / **`prost-types`** —— StreamingFast 客户端
- **`tonic`** —— gRPC（substreams 是 gRPC 上的协议）
- **`jsonrpsee`** —— JSON-RPC server
- **`anchor-lang`** —— Pump 的 BondingCurve 账户 deserialize
- **`solana-sdk`** / **`solana-client`** —— Solana 类型 + RPC
- **`spl-token`** —— Token account 解析
- **`tokio`** + **`futures`** —— 异步
- **`serde` + `toml`** —— 配置
- **`tracing`** —— 日志

## 六、可信度分级

| 条目 | 证据 |
|---|---|
| 4 种 DEX（Raydium AMM/CLMM/CPMM + Pump） | ★★★★★ rodata 明文串 |
| `TokenPriceRunner::deal_substream` / `deal_msg` | ★★★★★ Ghidra 确凿 |
| `SubstreamsStream` 是 `futures::Stream` impl | ★★★★★ Ghidra 确凿 |
| `TradingTrackerRpcServer` 2 个 RPC 方法 | ★★★★★ Ghidra 确凿 |
| Pump `BondingCurve` 用 anchor `AccountDeserialize` | ★★★★★ Ghidra 确凿 |
| 错误消息分支 | ★★★★☆ rodata 串确凿，枚举设计为推测 |
| 具体字段类型 | ★★★☆☆ 典型推测 |

## 七、深入研究的切入点

打开 Ghidra 项目，跳到以下符号看伪代码：
- `token_price_manager::runner::TokenPriceRunner::deal_msg` —— 看 4 种 DEX 怎么分发
- `token_price_manager::substreams_stream::SubstreamsStream::poll_next` —— 看 gRPC 流处理
- `<rpc::TradingTrackerServer as TradingTrackerRpcServer>::subscribe_token_price` —— 看订阅实现

然后找闭包（`{{closure}}` mangling 里带 `trading_tracker` 的那些）获取 async 业务代码。
