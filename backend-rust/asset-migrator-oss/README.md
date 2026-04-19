# `asset-migrator-oss`

**开源重写版**。替代 `backend-bin/asset-migrator/unipass_asset_migrator`
（31 MB 闭源 Rust ELF，68 内部 crate，actix-web + sqlx/MySQL + deadpool-redis + ethers）。

## 架构

```
┌────────┐  deposit  ┌──────────┐   ┌──────────────┐   ┌────────────┐
│ User   ├──────────▶│ Deposit  │   │  HTTP API    │   │  Custody   │
│ (src)  │           │  address │◀──┤ (actix-web)  ├──▶│  Wallet    │
└────────┘           └─────┬────┘   └──────────────┘   │  Service   │
                           │                           └────────────┘
                     ┌─────▼──────┐   ┌────────┐   ┌──────────────┐
                     │  Deposit   │──▶│ Redis  │──▶│  TxProcessor │
                     │  Indexer   │   │ stream │   │              │
                     └────────────┘   └────────┘   └──────┬───────┘
                                                          │
                                                   ┌──────▼───────┐
                                                   │  Submitter   │──▶  Dest chain RPC
                                                   └──────────────┘
```

三后台 worker + 一 HTTP 前端 + MySQL 状态 + Redis 流。

## 完成度

| 层级 | 状态 |
|---|---|
| Cargo crate / 依赖 | ✅ |
| SQL schema / migrations (6 表) | ✅ 从 ELF rodata 完整提取 |
| 配置类型（17 字段，4 个嵌套 struct） | ✅ + 7 单测 |
| 错误类型 + HTTP envelope | ✅ + 3 单测 |
| Logger | ✅ |
| DAOs（6 表全覆盖） | ✅ + 9 单测，含 serde、enum、limit clamp |
| Custody wallet HTTP 客户端 | ✅ + 4 wiremock 单测 |
| Deposit address 分配服务 | ✅ 骨架 + 1 单测 |
| MQ (Redis stream) | ✅ + 2 单测 |
| HTTP API (actix-web) | ✅ 4 路由 + 5 单测 |
| main.rs（DI + 信号） | ✅ |
| **Worker 业务逻辑** | 🟡 骨架 + 详细 TODO 指向 ELF 符号 |
| Dockerfile / README / CI 矩阵 | ✅ |
| **总测试** | **34/34 pass** |

## 未完成部分（worker 内循环）

剩余 ~1 周工作量：
- `deposit_indexer` — 链扫描（ethers provider）、getLogs 过滤 ERC20 Transfer、cursor 持久化
- `tx_processor` — Redis XREADGROUP 消费、outbound tx 构建、tx_activity 关联
- `submitter` — nonce 管理、gas price 封顶、RLP 签名、广播、receipt 追踪、stuck tx 替换

每个都在对应模块顶部写了详尽 TODO，对应 ELF `workers`/`tx_processor`/`submitter` crate 的符号块。

## 配置

- `CONFIG_PATH=./config/dev.json` 指向 `AssetMigratorConfigs` JSON 文件（字段列表见 `src/config.rs`）
- `RUST_LOG=info` / `LOG_OUTPUT_FORMAT=json`
- 配置中敏感字段（密码/私钥/webhook/signer key）**永远不会**随 `GET /config` 泄露——已有 `public_config_excludes_secrets` 单测保证

## 路由

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/healthz` | 存活探针 |
| GET | `/config` | 返回 `PublicConfig`（脱敏） |
| POST | `/deposit_address/bind` | 给 wallet 绑定一个未分配的 deposit address |
| GET | `/activity/{wallet}` | 近 50 条 tx_activity |

## 启动

```bash
# 迁移 + 启动
CONFIG_PATH=./config/dev.json cargo run --release
```

开发期需要 MySQL+Redis，可用 `docker compose`（或参考 dexauto-server 的 `dev-up.sh`）。
