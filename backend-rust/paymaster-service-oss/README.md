# `paymaster-service-oss`

**开源重写版**。替代 `backend-bin/paymaster-service/paymaster-service`
（18 MB 闭源 Rust ELF，jsonrpsee + ethers，ERC-4337 VerifyingPaymaster 签名服务）。

## 做什么

ERC-4337 VerifyingPaymaster 模式的**链下签名器** + JSON-RPC 服务：

```
钱包客户端 ──pm_sponsorUserOperation──▶ paymaster-service
                                             │
                                             │ 1. whitelist 检查
                                             │ 2. 生成 validity window
                                             │ 3. keccak(abi.encode(userOp, …, validUntil, validAfter))
                                             │ 4. ECDSA 签名（secp256k1）
                                             ▼
   paymasterAndData = paymaster_addr(20B) || validUntil(32B) || validAfter(32B) || sig(65B)
```

链上 VerifyingPaymaster 合约 ecrecover 签名对比 `verifyingSigner`，匹配则沿用。

## 完成度

✅ **29/29 测试全通**（26 unit + 3 真实 JSON-RPC 端到端）

| 模块 | 覆盖 |
|---|---|
| `config` | 10 测试（load/validate/whitelist/defaults） |
| `user_operation` | 5 测试（camelCase serde + 4 hash 不变量） |
| `paymaster` | 7 测试（sponsor/reject/whitelist/signer 确定性） |
| `rpc` | 4 测试（success + 3 error paths） |
| `integration` | 3 端到端（真实 jsonrpsee server + reqwest client） |

## RPC 方法（namespace `pm`）

### `pm_sponsorUserOperation(op, entryPoint, chainId) -> SponsorResponse`

签名一个 UserOperation。

**入参**：
- `op` — 标准 ERC-4337 v0.6 UserOperation（camelCase JSON）
- `entryPoint` — EntryPoint 合约地址，必须匹配 config 中该 chain 的设置
- `chainId` — u64

**返回**：
```json
{
  "paymasterAndData": "0x...",
  "preVerificationGas": "...",
  "verificationGasLimit": "...",
  "callGasLimit": "...",
  "validUntil": 1700000600,
  "validAfter": 0
}
```

**错误码**：
| Code | 含义 |
|---|---|
| -32001 | 不支持的 chain_id |
| -32002 | sender 不在 whitelist |
| -32003 | signer key 无效（启动期已守住，不应运行期出现） |
| -32004 | 签名失败 |
| -32602 | `entry_point` 与配置不匹配 |

### `pm_supportedEntryPoints() -> [Address]`

返回所有支持的 EntryPoint 地址（跨 chain 去重、sorted）。

## 配置

```jsonc
{
  "bind": "0.0.0.0:8080",                  // default 0.0.0.0:8080
  "signer_private_key": "0x...",            // 32 bytes hex
  "chains": {
    "1": {
      "paymaster_address": "0x...",         // VerifyingPaymaster contract
      "entry_point": "0x5FF137D4...0789"    // ERC-4337 v0.6 entry point
    },
    "137": { ... }
  },
  "whitelist": ["0xabc..."],                // optional; empty = open
  "validity_window_secs": 600               // default 600s
}
```

## 相对闭源 ELF 的改进

| 维度 | 闭源 | 本实现 |
|---|---|---|
| 私钥来源 | 硬编码 / 未加密 | env var 或配置文件，启动时校验长度+hex |
| whitelist | 存在但位置不明 | 纯配置，`Config::is_allowed()` 一目了然 |
| TLS | OpenSSL | rustls 静态 |
| Entry point 误用 | 签名但下游失败（silent） | 启动前比对，-32602 快速失败 |
| chain_id 覆盖 | 单一 | 多 chain map，启动期列出支持列表 |

## 启动

```bash
CONFIG_PATH=./config/dev.json paymaster-service
# 或
docker run -e CONFIG_PATH=/app/config.json -v $(pwd)/cfg.json:/app/config.json:ro ghcr.io/…
```

## 关键不变量（测试守护）

1. `paymasterAndData` = 固定 149 字节（20 + 32 + 32 + 65）
2. 前 20 字节必须等于 config 中该 chain 的 paymaster_address（否则 on-chain 校验失败）
3. hash 不依赖 `paymasterAndData` 和 `signature`（防签名自环）
4. hash 依赖 chain_id（防跨链重放）
5. signer_address 在任何构造下确定（同 priv_key 产同地址）
