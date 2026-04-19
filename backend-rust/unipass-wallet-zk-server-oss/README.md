# `unipass-wallet-zk-server-oss`

**开源重写版**。替代 `backend-bin/unipass-wallet-zk-server/unipass-wallet-zk-server`
（20 MB 闭源 Rust ELF：actix-web + PLONK (arkworks) + sqlx MySQL + Redis task stream）。

## 架构

```
    UniPass Wallet / Snap
          │   POST /gen_proof  { email, email_type }
          ▼
   ┌──────────────────────┐        XADD        ┌──────────────┐
   │   zk-server API      │─────────────────→  │ Redis stream │
   │   (actix-web)        │                    │  zk_tasks    │
   │                      │←── GET /gen_proof/{hash}
   └──────────┬───────────┘
              │
              │ upsert (EmailProofs)
              ▼
          MySQL

   [ scheduler ]
   XREADGROUP → Prover::prove(task) → upsert → XACK
```

## 完成度

✅ **34/34 测试通过**

| 层 | 文件 | 测试 |
|---|---|---|
| 类型 (enums + request/task/stage) | `types.rs` | 5 |
| 错误 (HTTP status mapping) | `error.rs` | 5 |
| 配置 (11 字段，mysql/redis URL) | `config.rs` | 10 |
| Redis stream 封装 | `mq.rs` | 1 |
| Prover trait + NoopProver | `prover.rs` | 5 |
| DAO (EmailProofs 11 列) | `daos/email_proofs.rs` | — (需真 MySQL) |
| Scheduler (run_one 完整 pipeline) | `scheduler.rs` | — (需真 MySQL) |
| HTTP API (3 端点) | `api/mod.rs` | 8 |

## HTTP

| 方法 | 路径 | 用途 |
|---|---|---|
| GET  | `/healthz` | liveness |
| POST | `/gen_proof` | 入队新证明任务，立即返回 `{ header_hash, stage: "pending", queue_id }` |
| GET  | `/gen_proof/{hash}` | 查询证明状态 + 结果行 |

## 核心设计决策

### Prover 抽象

**zk-email 电路本身不在本 OSS 重写范围内**。闭源 ELF 静态链接了 ~4MB arkworks PLONK SRS + 手写 DKIM 验证电路；从 stripped binary 提取电路源码不可行。

- `trait Prover` — 窄接口，`prove(&ProveTask) -> ProofArtifact`
- `NoopProver` — 确定性占位 impl，CI/集成测试用（明确非密码学安全）
- 生产部署应接入 upstream `UniPass-email-circuits`（Apache-2.0），自行 impl 这个 trait

### 日志兼容性

与闭源 ELF 完全一致的关键日志字符串，以便存量 log 仪表盘继续工作：
- `"Params 1024 Load finished"` / `"Params 2048 Load finished"` / `"PCKey Load finished"`
- `"Begin to prove:"` / `"prove sucessed"`（注意 typo，原样保留）/ `"prove failed"`
- `"task already existed — skipping"` / `"store email proof error"`

### 表结构

`EmailProofs` 11 列完整还原自 ELF rodata（`header_hash`/`email_type`/`from_left_index`/`from_len`/`success`/`public_inputs_num`/`domain_size`/`header_pub_match`/`public_inputs`/`proof`/`failed_reason`）。采用 `ON DUPLICATE KEY UPDATE` 幂等 upsert。

### Redis task stream

字段名 `payload`（对应 ELF rodata 字符串），以便新服务能消费老实例生产的 pending 任务，反之亦然。

## 未完成项（明确标注 TODO）

- 真实 PLONK prover impl（接 `upstream/UniPass-email-circuits` CLI 或静态库）
- 真实 XREADGROUP 消费循环（`scheduler::Scheduler::run_one` 已封装单次逻辑；需在 main.rs 内加 `tokio::spawn` 拉取循环，带 pending-entries-list 重放 + XACK）
- 真实 keccak256 header_hash 计算（当前 `cheap_header_hash` 仅做 API 侧 dedup key）
