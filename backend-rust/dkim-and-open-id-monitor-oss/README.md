# `dkim-and-open-id-monitor-oss`

**开源重写版**。替代 `backend-bin/dkim-and-open-id-monitor/dkim-and-open-id-monitor`
（17 MB 闭源 Rust ELF：monitors DKIM TXT records + OIDC JWKS vs on-chain registry, 触发 Slack 告警）。

## 架构

```
   DNS (TXT)          OIDC /certs          EVM chain logs
      │                   │                      │
      ▼                   ▼                      ▼
  dkim_dns::           jwks::                chain_log::
  fetch_one          fetch + fingerprint    logs_up_to
      │                   │                      │
      └──── live_map ─────┘──────── chain_map ───┘
                     │
                     ▼
                 reconciler::
                 reconcile
                     │
              ReconReport
                     │
         ┌───────────┴───────────┐
         ▼ is_alerting()?        ▼  no-op if empty
       slack::notify           (log only)
```

## 完成度

✅ **47/47 测试通过**

| 模块 | 文件 | 测试 |
|---|---|---|
| 配置 (11 字段, 全字段名匹配 ELF rodata) | `config.rs` | 10 |
| JWKS 获取 + fingerprint (keccak256(n‖e)) | `jwks.rs` | 8 |
| DKIM DNS TXT 解析 + fingerprint | `dkim_dns.rs` | 9 |
| Chain log 状态折叠 (revocation 感知) | `chain_log.rs` | 7 |
| Reconciler 差异 (missing/stale/ok 三桶) | `reconciler.rs` | 6 |
| Slack webhook | `slack.rs` | 7 |

## 配置字段（全部从 ELF rodata 恢复）

| 字段 | 用途 |
|---|---|
| `slack_webhook_url` | 告警出口 |
| `certs_check_interval_secs` / `chain_check_interval_secs` | 两套 polling 节奏 |
| `check_chain_sync` | 启用/关闭节点同步守卫 |
| `email.{imap_server_url,username,password,tls_type,smtp_server}` | IMAP + SMTP 自检账号（5 字段连续块） |
| `open_id_providers[].{iss,certs_url}` | OIDC JWKS endpoint |
| `dkim_targets[].{domain,selector}` | DKIM 监控对象 |
| `chain.{rpc_url,dkim_keys_contract,open_id_keys_contract,max_block_range}` | eth_getLogs 参数 |

## 核心设计决策

### Trait 抽象 → 测试可隔离

- `DkimResolver`：DNS 查询接口；`StubResolver` 供测试
- `ChainLogReader`：EVM 日志获取接口；`StubChainReader` 供测试

这样 **对业务逻辑的覆盖率接近 100%** 而不需要真 DNS/RPC。

### Fingerprint 方案

- **JWKS**：`keccak256(n_be || e_be)`（RSA 模数 + 指数直接拼接）
- **DKIM**：`keccak256(der_encoded_spki)`（base64 解码后的原始公钥 bytes）

两者都以 `0x`-prefixed 66 字符 hex 输出，与 on-chain 合约 log 中的 fingerprint 字段可直接字符串比对。

### 告警唯一判据

`ReconReport::is_alerting()` 只在 `missing_on_chain` 或 `stale_on_chain` 非空时返回 true。**链上"多余"的条目不告警**（revoked-but-not-cleared 历史数据不是威胁信号）。有一个专门的回归测试 `chain_has_extra_entries_is_not_alerting` 守护这个不变量。

### Chain state 折叠

`current_set` 按 block number 升序应用条目，revocation 删除该 key，后续 re-register 再加回。3 个测试覆盖这个重放逻辑（`latest_block_wins` / `honours_revocation` / `reregister_after_revoke`）。

## 未完成项

- **主编排循环**：`main.rs` 只保留启动/关停骨架 + 详尽注释。每个 ops 团队会倾向于插入自己的 `ChainLogReader` impl（ethers / alloy / 自建 indexer），因此把 loop 留为 wiring 任务，库模块已全部 ready
- 真实 `trust-dns-resolver` 实现（trait 已就位，~30 行即可接入 system resolver）
- IMAP 自检循环（`lettre` + `imap` crate 已在 deps）
