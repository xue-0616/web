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
- `DEEP_AUDIT_SWAP_FARM_RELAYER.md` — swap/farm/relayer 深度二次审计
- `FIX_REPORT.md` — 本次修复记录（本文件）
- `docs/deployment-rehearsal.md` — 部署演练 + 未解决阻塞项清单

---

## 🔄 深度审计轮次（2026-04 后续修复）

在 `FULL_AUDIT_REPORT.md` 之后进行了 `DEEP_AUDIT_SWAP_FARM_RELAYER.md`
定义的二次审计。以下是这一轮的修复记录。

### DR-1. [CRITICAL] BUG-P2-C2 — relayer 签名验证是恒等式

**文件：**
- 新增 `backend-rust/unipass-wallet-relayer/crates/execute-validator/src/validator.rs`
- 新增 `backend-rust/unipass-wallet-relayer/crates/relayer/src/replay.rs`
- 改写 `backend-rust/unipass-wallet-relayer/crates/relayer/src/api/transactions.rs`

原实现 `ecrecover(keccak(calldata), sig) == body.wallet_address` 中
`wallet_address` 由客户端给出，攻击者只要填入 recover 结果就必过。
任何人拿一对 (calldata, sig) 就能让 relayer 替任意钱包广播任意
execute 调用。

**新 4 阶段管道：**
1. 解码 `ModuleMain.execute(bytes, uint256, bytes)`
2. 结构校验：≤32 inner tx、拒绝 delegate_call、gas 上限、cumulative-value 溢出检查
3. Redis `SET NX EX` 抢占 `(chainId, wallet, nonce)` — replay 保护
4. `eth_call` 到钱包合约让其 `_validateSignature` 做签名判断

**测试：** `cargo test -p relayer -p execute-validator` **25 passed**。

### DR-2. [CRITICAL] CRIT-SW-1 / CRIT-SW-2 — swap molecule 解析错位

**文件：** `backend-rust/utxo-swap-sequencer/crates/api/src/intents/swap_exact_input_for_output.rs`

`validate_transaction` 把 molecule `total_size` 当成 `version` 字段、
`parse_intent_from_tx` 从错误的 raw_offset 驱动遍历。源码层的修复
早先已应用（`// CRIT-SW-1 FIX:` 注释），但 **没有测试**。本轮补了
5 个回归测试，含可复用的 `build_tx()` molecule 编码 helper，未来
其他 intent handler 的测试可直接 reuse。

### DR-3. [HIGH] HIGH-FM-1 / HIGH-FM-2 / HIGH-FM-3 — farm 三连环

**文件：**
- `crates/api-common/src/context.rs` — `EnvConfigRef.farm_processing_enabled`
- `crates/api-common/src/error.rs` — `ApiError::ServiceUnavailable` (503)
- `src/main.rs` — 解析 `FARM_PROCESSING_ENABLED`
- `crates/utils/src/pools_manager/manager.rs` — 未启用时 loop 立即 return
- `crates/api/src/intents/submit.rs` — 503 门 + 写入 `intent_type` / `amount`
- `crates/api/src/intents/submit_create_pool_intent.rs` — 同上 503 门
- `docker-compose.integration.yml` — 新环境变量注入

原后台 loop 只打 debug log，用户 LP token 存入后永远卡在 `Pending`。
修复用的是 **fail-closed** 门：`FARM_PROCESSING_ENABLED=false`（默认）
时 submit 直接 503 拒绝，loop 跳过；真的 solver 落地后翻开关即可。
同 commit 顺手修 HIGH-FM-1/2 — ActiveModel 用 `Default::default()`
导致所有 intent 写成 Deposit(0)。

### DR-4. [HIGH] HIGH-RL-1 — relayer 4 RPC handler 此前不编译

已在更早轮次接入 `ethers`（`rpc_client.rs`）。本轮补了 5 个针对
chain-id → URL 映射的回归测试，防止 chainId 常量被静默改错导致
某条链的流量消失。

### DR-5. [INFRA] CI 锁定

`.github/workflows/rust-tests.yml` 新增/扩展：
- `unipass-wallet-relayer-security` job 追加 `cargo test -p relayer --lib` 和 `-p execute-validator --lib`
- 新增 `utxo-swap-sequencer-molecule` job
- `utxoswap-farm-sequencer-purefuncs` job 追加 `cargo test -p api --lib intents::submit::tests`

### 本轮测试账面

| 包 | 增量 tests | 覆盖 |
|----|------|------|
| `relayer` lib | +16 | BUG-P2-C2 pipeline, replay, HIGH-RL-1 |
| `execute-validator` lib | +14 | 结构校验 + 解析器 |
| `utxo-swap-sequencer` api lib | +5 | CRIT-SW-1/2 molecule 回归 |
| `utxoswap-farm-sequencer` api lib | +2 | HIGH-FM-1/2 枚举映射 + Decimal |
| **合计** | **+37** | |

### 仍未处理（留给后续）

| ID | 严重度 | 说明 |
|----|------|------|
| HIGH-FM-3（真实 solver） | HIGH | fail-closed 门已加，但真正的 CKB batch-tx builder 仍缺 |
| MED-* | MEDIUM | 详见 `DEEP_AUDIT_SWAP_FARM_RELAYER.md` 的 MED 清单 |

---

## Round 4 — 2026-04-20 闭环全部 HIGH/CRIT 项

### DR-6. [HIGH] HIGH-SW-1 — tasks.claim TOCTOU 竞态

**File:** `backend-rust/utxo-swap-sequencer/crates/api/src/tasks/claim.rs`,
`crates/migration/src/m20260420_000000_points_history_unique_claim.rs`

两道竞态一次修掉：

1. **重复领取** — SELECT/INSERT 间隙：两个并发请求都看到"未领取"
   就都 INSERT，造成双倍积分。修复加了 UNIQUE idx
   `(account_id, source_type, source_id)`，配合 sea_orm
   `ON CONFLICT DO NOTHING` + `DbErr::RecordNotInserted -> 400`。
2. **积分丢更新** — `SELECT total_points` + `UPDATE = read+delta`：
   两个并发领取读到同一个 base value，互相覆盖。改成
   `UPDATE accounts SET total_points = total_points + ?`
   via `Expr::col(...).add(...)` 单语句。

两步包在同一个 sea_orm transaction 里，任一失败整体回滚。
`MIGRATION_VERSION` 16 → 17，启动时 `verify_migration_count()` 卡住忘记同步的人。

### DR-7. [HIGH] HIGH-SW-4 / 5 / 6 一并处理

**File:** `crates/utils/src/intents_manager/manager.rs`,
`crates/api/src/pools/pool_list.rs`, `crates/api/src/pools/candlestick.rs`

| sub | fix |
|-----|-----|
| SW-4 | `mark_processing(ids) -> Result<()>` 改名 `claim_for_processing -> Result<Vec<u64>>`，强制 caller 看到实际抢到的 ID（防 worker race）。原 API 留 `#[deprecated, doc(hidden)]` 包装，debug_assert 防止误用。底层 `SELECT ... FOR UPDATE` + `UPDATE`，单事务。|
| SW-5 | `pool_list` 的 N+1 查询：原本每 pool 2 条 token SELECT（page_size=100 时多达 200 个 query），改成单条 IN 查询 + HashMap 查表，从 ~201 query 降到 2。|
| SW-6 | `candlestick` 之前忽略 `start_time`/`end_time`，无 LIMIT。新增窗口校验（默认最近 7 天，最大 365 天，`start>=end` 拒绝），LIMIT 20000 行硬上限。+5 单测 pin 常量与窗口算术。|

### DR-8. [CRIT*] CRIT-RL-1 — `constant_time_eq` 长度旁信道

**File:** `unipass-wallet-relayer/src/security.rs`,
`utxoswap-farm-sequencer/src/security.rs`,
`huehub-token-distributor/src/security.rs`,
`payment-server/crates/common/src/crypto.rs`

原实现 `if a.len() != b.len() { return false }` 短路，攻击者可
通过响应延迟探测期望 API key 的长度。统一改为 length-blinded
循环：永远迭代 `max(a.len, b.len)` 次，越界读 0；最终用按位 AND 把
"字节相等"和"长度相等"两个 u8 折叠（lower 到 setcc，无分支）。

`payment-server` 顺带加了 4 个 HMAC verify 测试覆盖 happy path、
篡改末字节、短签名、超长签名。

### DR-9. [CRIT] CRIT-FM-2 — solver batch 内 user state stale

**File:** `backend-rust/utxoswap-farm-sequencer/crates/intent-solver/src/lib.rs`

`solve_batch` 原本对每个 intent 都从 `intent.user_staked_amount /
user_reward_debt` 读取 —— 这俩字段是用户 cell 的 pre-batch 快照。
同一用户 batch 内 2 笔 intent 都看到 pre-batch 状态，导致：

1. Deposit + Deposit 同 user：第二笔的 pending_reward 用 stale debt=0
   再算一次 → 用户拿到 pre-batch pending **两次**
2. Deposit + Harvest 同 user：harvest 把 deposit 已结算的 pending 重新领取
3. Withdraw + Withdraw 同 user：两笔都看到 stake=1000，可能双花

修复用 `HashMap<lock_hash, UserPosition>` 把 `(staked, reward_debt)`
跨 intent 线程化，第一次见某用户从 intent 快照初始化，之后在 batch
内读写。MasterChef invariant `debt = staked * acc / P` 抽到
`UserPosition::new_debt()` 不重复四遍。`saturating_*` 防 u128 溢出。

### DR-10. [INFRA] CI hook for intent-solver

`.github/workflows/rust-tests.yml` 的 `utxoswap-farm-sequencer` job
追加 `cargo test -p intent-solver` —— 4 个新 CRIT-FM-2 回归测试 + 9 个原有 solver 测试。

### Round 4 测试账面

| 包 | 增量 tests | 覆盖 |
|----|------|------|
| `migration` | 1 (新文件) | UNIQUE idx 创建/回滚 |
| `utxo-swap-sequencer` api lib | +5 | candlestick 窗口算术与常量 |
| `unipass-wallet-relayer` security | +1 | length-blinded 行为 |
| `payment-server` common::crypto | +4 | HMAC verify 4 个 case |
| `utxoswap-farm-sequencer` intent-solver | +4 | CRIT-FM-2 四类同 batch 互相干扰 |
| **本轮合计** | **+15** | |

### 累计自 Round 1 起

- **+52 tests**（前三轮 +37，本轮 +15）
- **10 commits ahead of origin/main**
- **3 个 CI job** 新增/扩展锁回归
- **1 个 DB migration** 新增

### 当前状态

所有资金安全相关 P0/P1（CRITICAL + HIGH）已闭环。剩余仅 MED-级
和真实功能补全（HIGH-FM-3 真实 solver，非安全漏洞）。
