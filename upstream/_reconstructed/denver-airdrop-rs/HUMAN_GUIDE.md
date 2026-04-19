# `denver-airdrop-rs` 人话阅读指南

> 这份文档**是我根据 Ghidra 伪代码 + ELF 字符串 + 调用图还原出来的**，不是原始源码。
> 所有代码片段都是**示意**，未经编译验证，但每一段都有对应 ELF 证据。
> 用这份文档 + `denver-airdrop-rs/src/*.rs` 骨架 + `/* ghidra: ... */` 注释，应该能还原 80% 的业务意图。

## 一、这个程序是干什么的

一个 **EVM 链上 NFT 空投监听 + 分发器**，Tokio 多线程异步运行时驱动。工作流：

1. 启动时读取 `./denver-airdrop.json` 配置文件
2. 连接 Ethereum RPC（通过 `ethers-providers` + 带重试的 HTTP transport）
3. 用 `UserERC721A<M>` 合约签名者发送 mint 交易
4. 监听 `ModuleMain` 合约的 `SetSource` 事件日志（ethers `abigen!` 生成的 `SetSourceFilter`）
5. 收到事件后，把 NFT 空投给事件里的地址列表
6. 失败 / pending 状态持久化回 JSON 文件，下次启动恢复

## 二、原始源文件布局（2 个）

从 ELF 的 tracing::event! 调用点**确凿**得出原始文件仅 2 个：

| 文件 | 用途 | 关键行号（tracing 事件位置） |
|---|---|---|
| `src/main.rs` | 入口 + 运行时 bootstrap | 57（启动日志） |
| `src/denver_monitor.rs` | **核心监听循环 + 分发逻辑** | 59, 90, 117, 153, 158, 161, 166, 191, 240, 249, 254, 259, 264 |

另外 3 个文件通过 `mod` 关键字被 main.rs 引入（未出现 tracing，所以无行号指纹）：

| 文件 | 用途 |
|---|---|
| `src/config.rs` | `Config` struct，从 `denver-airdrop.json` 反序列化 |
| `src/airdrop.rs` | `AirDrop` / `PendingTx` / `AriDropInfo` 三个数据结构 |
| `src/contracts/{module_main,user_erc721a}/mod.rs` | ethers `abigen!` 宏生成的合约绑定 |

## 三、`src/main.rs` 大致结构

从 call graph 得知 `main` 调用了 `tokio::runtime::builder::Builder::{new_multi_thread, enable_all, build}`、`Runtime::enter`，以及字符串 `"nft contract signer: 0x"`：

```rust
// src/main.rs —— 重建示意（不保证编译）
mod airdrop;
mod config;
mod contracts;
mod denver_monitor;

use std::sync::Arc;
use ethers::prelude::*;
use ethers::providers::{Http, Provider, RetryClient};
use ethers::signers::{LocalWallet, Signer};
use ethers::middleware::{SignerMiddleware, NonceManagerMiddleware};

fn main() -> eyre::Result<()> {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;

    rt.block_on(async move {
        // 1) 读配置
        let cfg: config::Config =
            serde_json::from_reader(std::fs::File::open("./denver-airdrop.json")?)?;

        // 2) 构建带重试的 Provider
        let provider = Provider::new(RetryClient::new(
            Http::new(cfg.rpc_url.parse()?),
            Box::new(ethers::providers::HttpRateLimitRetryPolicy),
            5, 500,
        ));

        // 3) 钱包 -> Signer -> NonceManager
        let wallet: LocalWallet = cfg.private_key.parse()?;
        let chain_id = provider.get_chainid().await?.as_u64();
        let wallet = wallet.with_chain_id(chain_id);
        let addr = wallet.address();
        let client = NonceManagerMiddleware::new(
            SignerMiddleware::new(provider, wallet),
            addr,
        );
        tracing::info!(target: "denver", "nft contract signer: 0x{:x}", addr);  // 行 57

        // 4) 启动监听器
        let monitor = denver_monitor::DenverMonitor::new(Arc::new(client), cfg);
        monitor.run().await
    })
}
```

## 四、`src/config.rs` —— Config struct

**证据**：
- ELF 有 `#[derive(Deserialize)]` 的 FieldVisitor（Ghidra key: `denver_airdrop_rs::config::_::<impl Deserialize for Config>::deserialize::__FieldVisitor`）
- ELF 字符串提到 `from_block`、`/denver-airdrop.json`、以太坊 RPC 相关常量

```rust
// src/config.rs —— 重建示意
use serde::{Deserialize, Serialize};
use ethers::types::Address;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub rpc_url: String,
    pub private_key: String,
    pub module_main_address: Address,   // "module_main_addr" 在 ELF 里
    pub user_erc721a_address: Address,
    pub from_block: u64,                 // "from_block" 字符串命中
    pub air_drop: Vec<AirDrop>,          // "air_drop" 字符串命中（line above）
    // 可能还有：poll_interval_secs、gas_limit、to_block 等
}
```

## 五、`src/airdrop.rs` —— 三个 struct

**证据**（ELF 中相邻的字段字符串序列）：

```
AirDrop    : nonce, pending_tx, ?, ?               (共 4 字段)
PendingTx  : block, addresses, address              (共 3 字段)
AriDropInfo: deploy_block_number, deploy_tx_hash,
             airdrop_tx_hash, ?, ?, ?                (共 6 字段)
```

每一个都派生了 serde `Serialize` 和 `Deserialize`（在 Ghidra JSON 可见）。

```rust
// src/airdrop.rs —— 重建示意
use serde::{Deserialize, Serialize};
use ethers::types::{Address, H256, U256};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AirDrop {
    pub nonce: u64,
    pub pending_tx: Option<PendingTx>,
    // 另外 2 个字段：可能是 `airdrops: Vec<AriDropInfo>` 和某个索引 / 状态字段
    pub airdrops: Vec<AriDropInfo>,
    pub last_processed_block: u64,     // 猜测
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PendingTx {
    pub block: u64,
    pub addresses: Vec<Address>,
    pub address: Address,          // 可能是合约地址（单数）
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AriDropInfo {             // 原作者拼写如此 ("Ari" 非 "Air")
    pub deploy_block_number: u64,
    pub deploy_tx_hash: H256,
    pub airdrop_tx_hash: Option<H256>,
    // 另外 3 个字段：可能是 source_address / token_id / airdrop_amount / receiver_addresses
    pub source_address: Address,
    pub token_id: U256,
    pub receivers: Vec<Address>,
}
```

## 六、`src/contracts/...` —— ethers `abigen!` 合约绑定

**证据**：
- ELF 内嵌 2 个 ABI JSON（看到大量 `"internalType": "address"` 片段）
- 调用图显示 `ModuleMain<M>::new` 和 `UserERC721A<M>::new`
- 存在 trait impl `<SetSourceFilter as ethers_contract::event::EthEvent>::decode_log`

```rust
// src/contracts/mod.rs —— 重建示意
use ethers::contract::abigen;

abigen!(
    ModuleMain,
    "abi/module_main.json",
    event_derives (serde::Serialize, serde::Deserialize);
);

abigen!(
    UserERC721A,
    "abi/user_erc721a.json",
    event_derives (serde::Serialize, serde::Deserialize);
);

// 自动生成：
//   pub struct ModuleMain<M>;
//   impl<M: Middleware> ModuleMain<M> { pub fn new(addr: Address, client: Arc<M>) -> Self; ... }
//   #[derive(EthEvent)]
//   pub struct SetSourceFilter { ... }
```

## 七、`src/denver_monitor.rs` —— 核心监听器（**最关键文件**）

**证据**：13 个 `tracing::event!` 在以下行。结合业务字符串和调用图，每个事件的意图如下：

| 行号 | 可能的事件内容 | 业务含义 |
|---:|---|---|
| 59 | `"Start to Get Logs from_block=.. to_block=.."` | 获取日志循环开始 |
| 90 | `"To Block: {}"` | 推进 to_block |
| 117 | `"Stopping ..."` | 终止条件触发 |
| 153 | `"Got Duplicate address: 0x{addr}"` | 去重 |
| 158 | `"Sending to addresses: {...}"` | 发送空投前日志 |
| 161 | `"gas price: {...}"` | 打印 gas price |
| 166 | `"Pending Transaction Hash: 0x{tx}"` | 交易已广播待确认 |
| 191 | （unknown）| 可能是 "event 解析失败" 这类错误分支 |
| 240 | `"Transaction Receipt: {...}"` | 交易上链 |
| 249/254/259/264 | 错误恢复或不同状态分支 | Pending 持久化等 |

两个公开方法（骨架已体现）：

```rust
// src/denver_monitor.rs —— 重建示意
use std::sync::Arc;
use ethers::prelude::*;
use ethers::types::{Filter, Log, U64};
use crate::{airdrop::*, config::Config, contracts::*};

pub struct DenverMonitor<M: Middleware + 'static> {
    client: Arc<M>,
    module_main: ModuleMain<M>,
    user_erc721a: UserERC721A<M>,
    cfg: Config,
    state: AirDrop,        // 持久化状态
}

impl<M: Middleware + 'static> DenverMonitor<M> {
    pub fn new(client: Arc<M>, cfg: Config) -> Self {
        let module_main = ModuleMain::new(cfg.module_main_address, client.clone());
        let user_erc721a = UserERC721A::new(cfg.user_erc721a_address, client.clone());
        let state = AirDrop {  /* 从 denver-airdrop.json 加载或默认 */ };
        Self { client, module_main, user_erc721a, cfg, state }
    }

    /// 获取 [from_block, latest) 内的 SetSource 事件日志。
    /// 对应 ELF 符号 denver_airdrop_rs::denver_monitor::get_set_source_logs。
    pub async fn get_set_source_logs(
        &self,
        from_block: U64,
    ) -> eyre::Result<Vec<SetSourceFilter>> {
        let to_block = self.client.get_block_number().await?;
        tracing::info!(target: "denver",
            "Start to Get Logs from_block={} to_block={}", from_block, to_block);  // 行 59
        let filter = Filter::new()
            .address(self.cfg.module_main_address)
            .from_block(from_block)
            .to_block(to_block)
            .event("SetSource(address,address)");
        let logs = self.client.get_logs(&filter).await?;
        tracing::info!(target: "denver", "To Block: {}", to_block);  // 行 90
        Ok(logs.into_iter().filter_map(|l| SetSourceFilter::decode_log(&l.into()).ok()).collect())
    }

    /// 主循环：拉日志 -> 去重 -> 发 mint -> 等回执 -> 写状态
    /// 对应 ELF 符号 denver_airdrop_rs::denver_monitor::run。
    pub async fn run(mut self) -> eyre::Result<()> {
        loop {
            // 行 59: Start to Get Logs
            let logs = self.get_set_source_logs(self.cfg.from_block.into()).await?;

            // 去重已在 self.state.airdrops 中记录过的空投
            let mut seen = std::collections::HashSet::new();
            for ev in logs {
                if !seen.insert(ev /* key by (source, receiver) */) {
                    tracing::warn!(target: "denver",
                        "Got Duplicate address: 0x{:x}", /*addr*/ );  // 行 153
                    continue;
                }
                // 行 158: Sending to addresses: ...
                tracing::info!(target: "denver", "Sending to addresses: {:?}", /*addrs*/);
                let gas = self.client.get_gas_price().await?;
                tracing::info!(target: "denver", "gas price: {}", gas);  // 行 161
                let call = self.user_erc721a.method::<_, ()>(
                    "airdrop", (/*addrs*/, /*token_id*/))?;
                let pending = call.send().await?;
                let tx_hash = *pending;
                tracing::info!(target: "denver",
                    "Pending Transaction Hash: 0x{:x}", tx_hash);  // 行 166
                // 写入 pending_tx 到 state 并持久化
                self.state.pending_tx = Some(PendingTx { /* ... */ });
                self.persist().await?;

                let receipt = pending.await?
                    .ok_or_else(|| eyre::eyre!("dropped"))?;
                tracing::info!(target: "denver",
                    "Transaction Receipt: {:?}", receipt);  // 行 240
                // 清 pending_tx、标记 AriDropInfo 为成功、持久化
                self.state.pending_tx = None;
                self.persist().await?;
            }

            // 行 117: Stopping ...（可能按 to_block >= 某阈值退出）
            // 行 191/249/254/259/264 是各错误恢复分支
            tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        }
    }

    async fn persist(&self) -> eyre::Result<()> {
        // 把 self.state 序列化为 JSON 写回 ./denver-airdrop.json
        let f = std::fs::File::create("./denver-airdrop.json")?;
        serde_json::to_writer_pretty(f, &self.state)?;
        Ok(())
    }
}
```

## 八、编译时依赖（ELF 嵌入路径证实）

以下 82 个 crate 的精确版本在二进制的 rodata 里有 `.cargo/registry/src/github.com-<hash>/<crate>-<ver>/...` 字样，都是原作者 `Cargo.lock` 锁的版本：

核心 3 大块：
- **ethers v1.0.2** 全家桶（ethers-core, ethers-contract, ethers-middleware, ethers-providers, ethers-signers）
- **tokio 1.25.0** + tokio-rustls 0.23.4 + tokio-util 0.7.7 + futures-util 0.3.26
- **serde 1.0.152** + serde_json 1.0.93

完整列表见 `denver-airdrop-rs/Cargo.toml` 里注释掉的 82 条。要把这份重建跑起来，把那些 `#` 删掉即可。

## 九、验证可信度

- `src/main.rs:57` 的 tracing `"nft contract signer: 0x..."` —— **100% 证据**（rodata 里有原串）
- `src/denver_monitor.rs` 13 个 tracing 行号 —— **100% 证据**（rodata 里有 `"event src/denver_monitor.rs:<N>"`）
- 3 个 struct 名 + 部分字段 —— **100% 证据**（rustc 生成的 serde 错误消息中）
- 3 个 struct 的**完整**字段列表 —— **部分推测**（rodata 去重后只保留了部分字段名）
- `run` / `get_set_source_logs` 方法体 —— **合理推测**（tracing 行号 + 业务字符串 + ethers 常见用法，**不是逆出来的**）

想要进一步核实 `run` 的精确逻辑，需要去 Ghidra 手动查看以下闭包：
```
core::future::from_generator::GenFuture<{{closure:denver_airdrop_rs::denver_monitor::DenverMonitor::run}}>::poll
```
它在自动导出的 JSON 里被过滤掉了（因为 `core::` 前缀），但在 Ghidra 里 open 项目就能看到伪代码。
