# `huehub-rgbpp-indexer-oss`

**开源重写版**。替代 `backend-bin/huehub-rgbpp-indexer/rgbpp`（18 MB 闭源 Rust ELF：RGB++ 跨 BTC + CKB 资产索引器 + JSON-RPC 查询服务）。

## 架构（适配器模式）

```
         CKB RPC                    Bitcoin RPC
            │                            │
            └──────── indexer ───────────┘
                        │
                upstream/rgbpp::decode  ← 开源协议解码（Apache-2.0）
                        │
                     Dao trait
                ┌───────┴───────┐
                ▼               ▼
           MemoryDao          redb  ← TODO wiring
           (tests / CI)
                │
                ▼
         jsonrpsee server
         6 RPC methods
```

## 完成度

✅ **44/44 测试通过**

| 层 | 文件 | 测试 |
|---|---|---|
| 配置（BTC/CKB endpoints + network 白名单） | `config.rs` | 9 |
| 错误 + jsonrpsee 映射 | `error.rs` | 4 |
| 域类型（8 struct 匹配 ELF rodata） | `types.rs` | 7 |
| 分页（opaque cursor + limit cap） | `pagination.rs` | 7 |
| DAO trait + MemoryDao | `dao.rs` | 7 |
| JSON-RPC 模块（6 方法 × 真实请求端到端） | `rpc.rs` | 10 |

## 6 个 RPC 方法（全部有测试，方法名匹配 ELF rodata）

| Method | Behaviour |
|---|---|
| `rgbpp_balances` | 返回 `account` 持仓（可按 `tokens[]` 过滤） |
| `rgbpp_holders` | 分页返回 `token` 的所有持有人 |
| `rgbpp_tokens` | 返回 TokenInfo 列表（supply / holders count） |
| `rgbpp_by_input` | 按 `(tx_hash, vin)` 查 RGB++ 事件 |
| `rgbpp_by_output` | 按 `(tx_hash, vout)` 查 RGB++ 事件 |
| `rgbpp_script` | 返回 `account` 在 BTC 或 CKB 的 TokenOutPoint 列表 |

## 关键设计

### DAO trait 隔离

ELF 用 `redb` 做嵌入式 KV（256 symbols）。本 OSS 版抽象为 `trait Dao`，CI 用 `MemoryDao`（`BTreeMap + RwLock`）跑 RPC 端到端测试，生产环境接入 redb 只需 ~30 LOC impl。这个设计让 RPC 层**完全不依赖存储实现**，也便于日后切换到 sled / fjall / rocksdb。

### Pagination 语义

- `next == None` iff 最后一页（`small_limit_produces_pagination` 守护）
- 未知 cursor → `BadRequest` → jsonrpsee `-32602 Invalid Params`
- Limit 上限 `MAX_LIMIT = 500`，0 或未提供回退到 `DEFAULT_LIMIT = 50`

### 协议解码不重写

RGB++ 的 molecule schema 和 CKB/BTC 证明解码在 `upstream/rgbpp/crates/core`（Apache-2.0）已有权威实现。本仓库只实现**索引器 + RPC 层**，解码部分作为 dep 接入。

## 未完成项

- **redb-backed Dao impl**：`main.rs` 临时用 `MemoryDao` 让 RPC 立即可测试；生产需实现 `RedbDao`（6 张表：`balances`/`holders`/`tokens`/`events_by_input`/`events_by_output`/`outpoints`，对应 ELF rodata 表名）
- **CKB 区块订阅循环**：trait `ChainWatcher` 留白，配 CKB WebSocket 或轮询 + `upstream/rgbpp::decode_transaction`
- **BTC light-client 索引**：对应 `upstream/rgbpp/crates/core/src/on_chain/bitcoin_light_client.rs`
