# `denver-airdrop-rs-oss`

**开源重写版**。替代 `backend-bin/denver-airdrop-rs/denver-airdrop-rs`（14 MB 闭源 Rust ELF：EVM NFT 空投监听器 + 分发器）。

## 架构

```
     denver-airdrop.json
            │
            ▼
      Config (rpc, pk, contracts, from_block, air_drop[])
            │
            ├─── paginate(from, latest, block_step) ──┐
            │                                          ▼
            │                              eth_getLogs (SetSource)
            │                                          │
            │                              dedup::filter_new
            │                                          │
            │                              mint(receiver) × N
            │                                          │
            ▼                                          ▼
   statefile::save  ────────── AirDrop + AriDropInfo persisted
   ({store_dir}/0x{src}.json)
```

## 完成度

✅ **38/38 测试通过**

| 模块 | 文件 | 测试 |
|---|---|---|
| 配置（所有字段名匹配 ELF rodata） | `config.rs` | 10 |
| State types（`AirDrop`/`PendingTx`/`AriDropInfo` 保留原 typo） | `airdrop.rs` | 4 |
| 原子 state file（tmp + rename） | `statefile.rs` | 8 |
| 去重（seen + 批次内） | `dedup.rs` | 6 |
| Block range 分页 | `block_range.rs` | 10 |

## 关键设计

### `AriDropInfo` 拼写原样保留

ELF 符号是 `AriDropInfo`（不是 `AirDropInfo`），这是原作者的 typo。**不修正**，以便存量 `{store_dir}/*.json` 状态文件能直接被新二进制消费。

### 原子 state 写入

`save()` 采用经典 `write-tmp → fsync → rename` 三步，有专门测试守护 `*.tmp` 残留（`save_is_atomic_tmp_not_left_behind`）。

### 去重双层语义

`dedup::filter_new` 同时处理（1）历史已空投的地址 和 （2）同一批次内的重复。前者防跨 tx 双花 gas，后者防单 tx 内部重复浪费。

### Block range 分页语义

`paginate(start, end, max_span)` 返回闭区间列表，契约由 `ranges_are_contiguous_and_nonoverlapping` 测试守护；u64 极大值不溢出（`handles_large_numbers_without_overflow`）。

## 未完成项

- **ethers 链上连接**：`main.rs` 留 TODO + 描述。库层模块（分页 / 去重 / 状态持久化）已 100% 可独立测试，ethers `Provider`/`SignerMiddleware`/`NonceManagerMiddleware` 拼装是纯 wiring 任务
- **`SetSourceFilter` abigen**：ABI JSON 需要从 ELF rodata 重构或从 `upstream/ModuleMain` 获取 —— 本 OSS 版把 event topic 视为 `SetSource(address,address)`（从 rodata 字符串确认）
