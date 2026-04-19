# 修复执行报告

> 基于 `FULL_AUDIT_REPORT.md` 的问题清单，按 P0 → P1 → P2 顺序修复。
> 所有改动均保持 `tsc --strict` 和 `cargo check` 零错误。

---

## ✅ 已完成 (P0 + P1)

### 1. [P0] SQL 注入 — `unipass-cms-backend`

**文件：`backend-node/unipass-cms-backend/src/modules/unipass/relayer/gas.statistics.service.ts`**

- 新增 `buildWhere(...)` 辅助，将 `timeStart`/`timeEnd`/`submitter`/`chainId` 改为参数化绑定
- `submitter` 通过 `UNHEX(?)` 绑定（先用 `normalizeHexFilter` 严格校验 hex）
- `skip` / `limit` 改为 `?` 绑定
- 3 处受影响方法全部改造：`getRelayerGasList`、`getIncomeExpenseGroupByChainId`、`getIncomeExpenseList`
- `normalizeHexFilter` 新增正则校验 `^[0-9a-fA-F]+$`，非法输入抛错

### 2. [P0] unipass-wallet-relayer — 4 个 RPC stub 全部对接 `ethers`

**新增文件：**
- `backend-rust/unipass-wallet-relayer/crates/relayer/src/api/rpc_client.rs`
  - `rpc_url_for_chain(cfg, chain_id)` 支持 `1`/`56`/`137`/`42161`
  - `provider_for_chain(cfg, chain_id)` 返回 `Arc<Provider<Http>>`

**改写的 handler：**

| 文件 | 原实现 | 现实现 |
|------|-------|-------|
| `api/nonce.rs` | `stub = 0` | `provider.get_transaction_count(addr, Latest)` |
| `api/meta_nonce.rs` | `stub = 0` | `ModuleMain::new(addr, provider).meta_nonce().call()`（钱包未部署时回落到 0） |
| `api/receipt.rs` | `stub = null` | `provider.get_transaction_receipt(hash)` |
| `api/simulate.rs` | `hardcoded gas=200000` | `provider.estimate_gas(tx, None)`；revert 时返回 `{success:false, reason}` |

**依赖改动：**
- `crates/relayer/Cargo.toml` 新增 `contracts-abi` + `configs` 路径依赖

### 3. [P0] huehub-token-distributor — 防止 DB 撒谎 (CKB SDK 未集成前)

**文件：`backend-rust/huehub-token-distributor/src/main.rs`**

- 新增 `BgConfig::submission_enabled`，来自 `ENABLE_CKB_SUBMISSION` 环境变量
- `process_single_distribution` 和 `process_single_mint` 都加入**安全阀门**：
  - 若 `submission_enabled = false`，事务**回滚**，记录保持 `Pending`，仅打印警告
  - 防止在未真正上链的情况下将记录误标为 `Submitted`
- 启动时若未设置该环境变量会显式警告

> CKB xUDT mint/distribute 交易构建本身（ckb-sdk-rust 集成）仍为 TODO，但现在即使 TODO 存在，系统不会再产生"DB 成功、链上无动"的幽灵状态。

### 4. [P1] utxoswap-farm-sequencer — 管理员白名单强制

**文件：**
- `backend-rust/utxoswap-farm-sequencer/crates/api-common/src/context.rs`
  - `EnvConfigRef` 新增 `admin_addresses: Vec<String>` 字段
  - 新增方法 `is_admin(&self, addr)`
- `backend-rust/utxoswap-farm-sequencer/crates/api-common/src/error.rs`
  - `ApiError` 增加 `Forbidden(String)` 变体（HTTP 403）
- `backend-rust/utxoswap-farm-sequencer/src/main.rs`
  - 启动时读取 `FARM_ADMIN_ADDRESSES`（逗号分隔），空时发出警告
- `backend-rust/utxoswap-farm-sequencer/crates/api/src/intents/submit_create_pool_intent.rs`
  - 非 admin 地址的 `create-pool` 请求直接返回 `403 Forbidden`

> 这关闭了"任何人都能提交创建池子意图"的严重漏洞。密码学签名校验保留为**二层防御**的 TODO。

### 5. [P1] `unipass-wallet-backend` — `@ts-nocheck` 标记技术债

**影响文件（12 个）：**
```
src/mock/{mock.data,config}.ts
src/shared/{utils/wallet,utils/webauthn,services/providers.server}.ts
src/modules/account/account.module.ts
src/modules/account/service/{webauthn.service,transaction/{transaction.worker.service,query-abi.service,sync.account.server},asset/{nft.service,nft.parse}}.ts
```

- 移除 `@ts-nocheck` 后暴露 96 个真实类型错误（模块声明缺失、重复 `Wallet` 标识等）
- 经分析为**反编译残留**，修复需要原始代码
- **处理方式**：保留 `@ts-nocheck`，但替换为带 FIXME 的注释以记录技术债：
  ```ts
  // @ts-nocheck - FIXME: decompilation artifact, requires original source to fix properly
  ```

### 6. [P2] 空 catch / console.log 清理

| 文件 | 改动 |
|------|------|
| `dexauto-server/wallet-scorer.service.ts:447,466` | `.catch(() => {})` → `.catch(err => logger.warn(...))` |
| `dexauto-server/shredstream-prefetch.service.ts:342-344` | 3 处空 catch 改为 `logger.debug` |
| `huehub-dex-backend/market.tokens.service.ts:100` | 删除 `console.log({ rawResults })` 调试残留 |
| `huehub-dex-dobs-backend/market/tx.service.ts:32` | 删除 `console.log(this.service)` 调试残留 |

### 7. [P2] NPM audit

- `dexauto-server`: critical 4→3, high/moderate/low 几乎未变（transitive 依赖需 `--force` 主版本升级）
- 未执行 `npm audit fix --force` — 风险（会引入 breaking changes 14 个项目跨版本）
- **建议**：由开发者逐项目评估后手动升级

### 8. [P2] Rust `cargo fix`

- 对所有 8 个 Rust 项目执行了 `cargo fix --allow-no-vcs`
- 剩余 warnings 均为 `dead_code` / `never_read` 类语义性警告，需要人工判断是否真实死代码
- 不影响构建

---

## 🟡 未修复（需要更多信息/工作量超出自动化范围）

### A. huehub-token-distributor — 真实 CKB 交易构建
- 3 处 TODO 需要 `ckb-sdk-rust` 集成 + xUDT 合约脚本参数
- 已通过**安全阀门**确保在集成完成前系统不会撒谎
- 上线前需：
  1. 添加 `ckb-sdk = "3.x"` 到 workspace
  2. 实现 `build_xudt_transfer_tx` / `build_xudt_mint_tx`
  3. 实现 `query_tx_status` 查链确认
  4. 设置 `ENABLE_CKB_SUBMISSION=true`

### B. unipass-wallet-relayer — `execute-validator::contract_simulator`
- `gas_used = 200_000` 硬编码（第 35 行）
- 已接入 `ethers` 的 `simulate.rs` handler 可以替代，但 `execute-validator` 是内部 pre-flight 用途
- 建议：复用 `rpc_client::provider_for_chain` + `provider.estimate_gas`

### C. payment-server
- `estimated_fee.rs`: 费率硬编码（BUG-17）— 需要链上 oracle 对接
- `alchemy_pay/on_ramp_webhook.rs:106`: webhook 支付确认后的订单状态更新未实现
- `chain_events/events.rs:67`: 失败支付退款流程未实现
- 上述 3 项都是**业务流程缺口**，需要产品层决策如何处理，非纯技术修复

### D. `dexauto-trading-server` — Raydium AMM 池子状态解析
- `crates/tx-builder/src/raydium_amm/common/rpc.rs:86`: TODO
- 需要 Solana `getAccountInfo` + Raydium pool layout 解码
- 属于深度业务代码，需要专业 Solana 经验

### E. `unipass-wallet-backend` 反编译残留
- 12 个文件的 96 个类型错误本质是反编译丢失了顶层声明
- 需要原始源码或人工逐文件重建，单次会话无法完成

### F. NPM 依赖漏洞
- 剩余 critical/high 均需 `--force` 引入 breaking changes
- 建议按项目逐个升级并跑完整回归

### G. 184 处 `as any`、170 处 `process.env.X`
- 分散在 14 个项目、大量文件中
- 需要长期逐处替换为精确类型 / 集中到 `AppConfigService`
- 不阻塞构建

---

## 本次构建状态 (终态)

```
backend-node (14 项): tsc --strict 0 errors ✅
backend-rust  ( 8 项): cargo check   0 errors ✅
backend-bin  _scaffold (10 项): cargo check 0 errors ✅
backend-python      ( 1 项): py_compile OK ✅
```

## 审计链路追踪

- `FULL_AUDIT_REPORT.md` — 原始审计报告
- `FIX_REPORT.md` — 本次修复记录（本文件）
