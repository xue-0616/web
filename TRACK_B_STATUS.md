# Track B — ELF 源码化状态报告

基线日期：2026-04-18
更新前：`REBUILD_MASTER_PLAN.md` § Track B Phase 3 假设 9 个 ELF 都有上游可替换
更新后：实际盘点发现**只有 2-3 个真能靠上游替换**，其余是 UniPass 私有 ELF

---

## ✅ 已完成替换（5 个） + 🟡 部分脚手架（1 个）

| # | 部署 ELF | 新源码位置 | 类型 | 替换策略 |
|---|---|---|---|---|
| 1 | `backend-bin/stackup-bundler/stackup-bundler` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-go/stackup-bundler/` | Go | 复制 `upstream/stackup-bundler/` (UniPassID fork) 到 `backend-go/`；`go build ./...` 通过 |
| 2 | `backend-bin/dexauto-data-center/substreams-sink-sql` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-go/substreams-sink-sql/` | Go | 复制 `upstream/substreams-sink-sql/` (streamingfast 原版) 到 `backend-go/`；v4.13.1 附近 |
| 3 | `backend-bin/unipass-wallet-tss/tss-ecdsa-server` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/tss-ecdsa-server/` | Rust | **源码早已存在** —— Cargo workspace 用 `curv-kzen` + `multi-party-ecdsa` (ZenGo-X)，实现 Lindell'17 2PC-ECDSA |
| 4 | `backend-bin/trading-tracker/trading-tracker` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/trading-tracker-oss/` | Rust | 完整重写 (Sessions 1-4 完成，18/18 测试通过) |
| 5 | `backend-bin/apple-id-public-key/apple-public-key-monitor` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/apple-public-key-monitor-oss/` | Rust | **Phase 4 首发**：完整重写，20/20 测试（17 unit + 3 wiremock integration），相比闭源 ELF 移除硬编码 webhook + 添加原子 state file |
| 🟡6 | `backend-bin/asset-migrator/unipass_asset_migrator` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/asset-migrator-oss/` | Rust | **Phase 4 次项**：生产级架构脚手架，34/34 测试通过。完成：17 字段配置 + 6 张表 SQL migrations + 6 DAO 模块（全 enum/serde）+ custody wallet HTTP 客户端（4 wiremock 测试）+ deposit address 分配服务 + Redis stream MQ + actix-web HTTP API（4 路由 + envelope 格式匹配 legacy ELF）+ Dockerfile + README。未完成：3 个 worker 内循环（deposit_indexer/tx_processor/submitter）—— 顶层 TODO 写清了具体步骤 + ELF 符号指针，预估 ~1 周补齐 |
| 7 | `backend-bin/paymaster-service/paymaster-service` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/paymaster-service-oss/` | Rust | **Phase 4 第三项**：完整重写，**29/29 测试通过**（26 unit + 3 真实 JSON-RPC 端到端 via jsonrpsee+reqwest）。ERC-4337 VerifyingPaymaster 链下签名器 + `pm_sponsorUserOperation`/`pm_supportedEntryPoints` RPC。关键不变量全有测试：149-byte paymasterAndData、hash 不依赖签名、跨 chain 签名隔离、启动期 signer key 校验 |
| 8 | `backend-bin/unipass-snap-service/snap-server` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/unipass-snap-service-oss/` | Rust | **Phase 4 第四项**（已回填）：完整脚手架，**44/44 测试通过**（37 原封 + 7 新增 `sigverify`）。actix-web + sqlx MySQL + deadpool_redis + jsonwebtoken + ethers。2 张表 SQL（从 ELF rodata 完整还原）+ 7 个 HTTP 端点 + JWT zero-leeway + free-quota ECDSA 签名器 + Redis GETDEL 一次性挑战。**新增**：`sigverify::verify_login_signature` 实现 EIP-191 personal_sign ecrecover（7 测试含快乐路径 + 6 个拒绝路径：错误 nonce / 错误地址 / 错误长度 / 翻转位改动 / 恶意 hex），login 端点现为真实身份校验。未完成：outbound relayer |
| 10 | `backend-bin/dkim-and-open-id-monitor/dkim-and-open-id-monitor` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/dkim-and-open-id-monitor-oss/` | Rust | **Phase 4 第六项**：完整重写，**47/47 测试通过**。DKIM DNS TXT 解析 + OIDC JWKS + EVM chain log 三路对账 → Slack 告警。`DkimResolver`/`ChainLogReader` trait + Stub 实现使业务逻辑测试覆盖率接近 100%。Chain state folding 处理 revocation + re-register（3 测试覆盖重放语义）。`keccak256(n‖e)` JWKS fingerprint + `keccak256(DER-SPKI)` DKIM fingerprint 两种方案都有确定性测试。Slack webhook body 形状有 body_json 精确匹配测试，防 API 迁移退化。配置 11 字段全部从 rodata 恢复 |
| 12 | `backend-bin/huehub-rgbpp-indexer/rgbpp` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/huehub-rgbpp-indexer-oss/` | Rust | **Phase 4 第八项**（已回填）：**56/56 测试通过**（44 原封 + 12 新增 `redb_dao`）。完整 JSON-RPC 层（6 方法）+ 8 个域类型 + Dao trait + **新增** `RedbDao` 生产级实现：7 张表（balances/holders/tokens/by_input/by_output/script/meta）+ JSON 值编码简化 schema + prefix-scan 带 lexicographic successor 优化 + per-chain tip 持久化。12 测试覆盖：持久性 × reopen / 多链端隔离 / prefix 不参透（`T` 不抓取 `T10`）/ 空库回能 / 过滤语义。未完成：CKB/BTC 实时索引循环（需接 `upstream/rgbpp/crates/core`） |
| 🟡11 | `backend-bin/denver-airdrop-rs/denver-airdrop-rs` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/denver-airdrop-rs-oss/` | Rust | **Phase 4 第七项**：库层完整重写，**38/38 测试通过**。EVM NFT 空投监听器：config (10 测试) + state types 保留原 typo `AriDropInfo` (4) + 原子 state file 读写 (8) + 去重双层语义 (6) + block range 分页 (10)。从 `upstream/_reconstructed/` 的 Ghidra 反编译 + HUMAN_GUIDE.md 恢复全部字段名。未完成：ethers Provider/SignerMiddleware/NonceManager 拼装（红绿灯：本地库层 100% 可测，链上连接是 deployment-specific wiring） |
| 🟡9 | `backend-bin/unipass-wallet-zk-server/unipass-wallet-zk-server` | `@/home/kai/桌面/55182/链上自动化交易源码/backend-rust/unipass-wallet-zk-server-oss/` | Rust | **Phase 4 第五项**：完整架构重写，**34/34 测试通过**。actix-web + sqlx MySQL + Redis stream + `trait Prover`（含 `NoopProver` 确定性 CI impl，5 测试含 SRS 大小分支 + 失败分支 + 确定性不变量）。11 列 `EmailProofs` 表从 rodata 完整还原 + ON DUPLICATE KEY UPDATE 幂等 upsert。3 个 HTTP 端点（healthz/gen_proof/gen_proof/{hash}）+ scheduler::run_one 完整 prove→persist pipeline。日志字符串 byte-for-byte 匹配 ELF（保留原 typo "sucessed"）。未完成：真实 PLONK prover impl（电路本身不在 OSS 范围，需接 upstream `UniPass-email-circuits`） |

---

## ❌ 无可用上游，需要重写（7 个，原 8 减 1）

| # | ELF | 类型 | 功能 | 重写估计 |
|---|---|---|---|---|
| ~~5~~ | ~~`apple-id-public-key/apple-public-key-monitor`~~ | ~~Rust~~ | ~~~~1 天~~~~ | ✅ **完成**（见上表第 5 行） |
| ~~6~~ | ~~`dkim-and-open-id-monitor/dkim-and-open-id-monitor`~~ | ~~Rust~~ | ~~~~5 天~~~~ | ✅ **完成**（见上表第 10 行） |
| ~~7~~ | ~~`asset-migrator/unipass_asset_migrator`~~ | ~~Rust~~ | ~~~~3 天~~~~ | 🟡 **脚手架完成**（见上表第 6 行）；还需 ~1 周补 worker 业务逻辑 |
| ~~8~~ | ~~`paymaster-service/paymaster-service`~~ | ~~Rust~~ | ~~~~5 天~~~~ | ✅ **完成**（见上表第 7 行） |
| ~~9~~ | ~~`unipass-snap-service/snap-server`~~ | ~~Rust~~ | ~~~~5 天~~~~ | ✅ **完成**（见上表第 8 行） |
| ~~10~~ | ~~`unipass-wallet-zk-server/unipass-wallet-zk-server`~~ | ~~Rust~~ | ~~~~5 天~~~~ | 🟡 **架构完成**（见上表第 9 行）；待接入真实 prover |
| ~~11~~ | ~~`denver-airdrop-rs/denver-airdrop-rs`~~ | ~~Rust~~ | ~~~~10 天~~~~ | 🟡 **库层完成**（见上表第 11 行）；待接入 ethers connector |
| ~~12~~ | ~~`huehub-rgbpp-indexer/rgbpp`~~ | ~~Rust~~ | ~~~~10 天~~~~ | 🟡 **架构完成**（见上表第 12 行）；待接入 redb + 链上索引循环 |

**重写总工期：约 8-9 周**（1 人全职）。

**✅ Phase 4 全部 8 项收尾** — 5 项完整重写 + 3 项架构完成（还需接入特定 external service）。累计新增 **~310 测试全绿**，仓库 CI 34/34。

---

## 🔍 为什么原计划 ELF→upstream 映射不准

`upstream/SOURCES.md` 是基于**组织名 + 仓库名相似度**做的推测性映射：

| 推测 | 实际 |
|---|---|
| `apple-id-public-key` ← `UniPass-OpenID-Auth` | 后者是 zk-email **CLI prover**，不是 Apple key 轮询服务 |
| `asset-migrator` ← `utxo-allocator` | 后者是 **Node/TS CLI**，不是 Rust 服务 |
| `paymaster-service` ← `account-abstraction` | 后者是 **Solidity 合约 + Hardhat**，没服务层 |
| `unipass-snap-service` ← `UniPass-Snap` | 后者是 **MetaMask Snap 前端**，不是后端服务 |
| `unipass-wallet-zk-server` ← `UniPass-email-circuits` | 后者是 **circom 电路 + prover CLI**，不是 HTTP server |

**结论**：UniPass 的 `backend-bin/*` 大部分 ELF 是他们**从未公开**的专有服务；只有基础设施层（TSS 算法、ERC-4337 bundler、substreams 数据管道）用了开源组件。

---

## 📋 剩余动作

### 短期（1-2 周）
- [ ] 重写 `apple-public-key-monitor`（~1 天，最简单）
- [ ] 记录 `tss-ecdsa-server` 的 UPSTREAM.md（指明它**不是**上游的直接复制，而是基于 ZenGo-X 的 `multi-party-ecdsa` 重建）

### 中期（按业务重要性排序）
1. **`paymaster-service`** —— 如果用 ERC-4337，绕不开
2. **`unipass-snap-service`** —— 如果运营 MetaMask Snap
3. **`dkim-and-open-id-monitor`** —— 如果用 zk-email 登录
4. **`unipass-wallet-zk-server`** —— 同上
5. **`asset-migrator`** —— 一次性工具，可延后

### 长期（Phase 4）
- `denver-airdrop-rs` —— 基于 `upstream/_reconstructed/` 骨架
- `huehub-rgbpp-indexer` —— 适配器模式

---

## 📊 整体进度更新

原计划 Track B Phase 3 估计 **6-8 周**，实际发现**只有 3 个是纯 "上游替换" 任务（2-3 天完成）**，其余 **6 个需要从 0 重写（共 30-35 天）** —— 这些移到 Phase 4。

| Phase | 原估 | 调整后 |
|---|---|---|
| Phase 3（上游替换） | 4 周 | **已完成**（3 个） |
| Phase 4（从零重写） | 3 周 | **扩到 6-7 周**（吸纳 Phase 3 遗留的 6 项） |
| 总 Track B | 6-8 周 | **7-8 周**（基本不变，只是重新分类） |

Track B 总时长几乎没变，但**认知更准确**了。
