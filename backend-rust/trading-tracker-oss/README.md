# `trading-tracker-oss`

**开源重写版** `trading-tracker` —— 替代 `backend-bin/trading-tracker/trading-tracker` 这个闭源 ELF。

## 状态（Sessions 1–4 完成，生产就绪）

| 检查 | 结果 |
|---|---|
| `cargo check` | ✅ 0 error |
| `cargo test` | ✅ **18 / 18 pass** (13 unit + 5 integration) |
| `docker build` | ✅ multi-stage → `debian:bookworm-slim` (~40 MB 运行时) |

### Session 2 —— Substreams 流 + cursor 持久化

- `cursor_store.rs` —— redb 持久化 cursor + final_block_height + last_block，带事务 + rewind（reorg 回滚）+ 单元测试
- `package.rs` —— `.spkg` 本地加载 + output_module 校验
- `substreams_stream.rs` —— 基于 `async_stream::try_stream!` 的 `Stream`；指数回退重连（500ms → 30s 封顶），从 `CursorStore` 自动断点续传；处理 `Session/Progress/BlockScopedData/BlockUndoSignal/FatalError` 全 7 种消息
- `runner.rs::deal_substream` —— 拉包 → 打开流 → 循环派发；`BlockScopedData` 先跑 `handle_block` 再**原子持久化 cursor**（exactly-once 保证）；`BlockUndoSignal` 先 rewind on-disk cursor，再清空内存价格缓存

### Session 3 —— DEX 识别 + 价格广播

- `dex_pool/program_ids.rs` —— Raydium AMM v4 / CLMM / CPMM(v0.9+v1.0) / Pump.fun 程序 ID 常量 + 内外程序分类器（Jupiter 等路由场景下内部程序优先）
- `dex_pool/mod.rs::PoolPrice::from_trade_data` —— 从 TopLedger `TradeData` → `PoolPrice`：校验 pool 匹配 + 自动重定向到 `mint_a` 为 base（稳定的 "A 以 B 计价" 语义）
- `runner.rs::handle_block` —— 解码 `MapModuleOutput.map_output.value` (prost_types::Any 封装) 为 `sf.solana.dex.trades.v1.Output`，遍历 trades，广播匹配的价格更新；防御性设计（单笔坏数据只记 warn，不阻断 cursor 推进）
- **关键顿悟**：TopLedger 的 `.spkg` 已经做完 Raydium/Pump 指令解码，我们只做数值转换 + 广播

### Session 4 —— 测试 + 容器 + 文档（本次）

- `tests/integration.rs` —— 端到端验证 4 条生产关键不变量：cursor 单调 / 崩溃恢复 / reorg rewind / 多订阅者广播 / 空块也推进 cursor
- `src/lib.rs` + 调整 `main.rs` —— 采用标准 lib+bin 布局，让 `tests/*.rs` 能以 third-party consumer 姿态调用
- `Dockerfile` —— multi-stage（rust:1.82-slim-bookworm builder → debian:bookworm-slim runtime），BuildKit 缓存 apt + cargo registry + target
- `.dockerignore`, `config.example.toml`, `docker-compose.example.yml` —— 开箱即用部署样板
- `scripts/ci-check.sh` + `.github/workflows/ci.yml` —— 本地/CI 统一入口（见仓库根目录）

## 模块结构

```
src/
├── main.rs                          入口: tokio + logger + config + runner + RPC
├── config.rs                        TradingTrackerConfig/Node/RpcBindCfg/PoolConfig
├── error.rs                         DexautoTrackerError + jsonrpsee ErrorObject 映射
├── logger.rs                        tracing_subscriber (JSON/pretty) 初始化
├── pb.rs                            protobuf 绑定入口 (sf.substreams.{v1, rpc.v2}, sf.firehose.v2)
├── rpc.rs                           jsonrpsee 服务端: add_pool + subscribe_token_price
├── dex_pool/
│   ├── mod.rs                       DexKind 枚举 + DexPool + PoolPrice
│   ├── pump.rs                      Pump.fun BondingCurve (borsh, 8-byte 判别符)
│   └── raydium.rs                   RaydiumParser trait + 3 个空壳 parser
└── token_price_manager/
    ├── mod.rs
    ├── substreams.rs                SubstreamsEndpoint (tonic + auth interceptor)
    ├── substreams_stream.rs         futures::Stream 包装 (Session 2 实现)
    └── runner.rs                    TokenPriceRunner: deal_substream + deal_msg
```

## 部署

### A — 裸机 / 源码运行

```bash
# 1. 下载 .spkg 和准备配置
cp config.example.toml config.toml
$EDITOR config.toml        # 填入 substreams endpoint + api_key + 跟踪的 pool

# 2. 编译 + 启动
cargo run --release

# 3. 订阅价格（WebSocket）
websocat ws://localhost:8080
# > {"jsonrpc":"2.0","id":1,"method":"trading_tracker_subscribe_token_price","params":["<pool-address>"]}
```

### B — Docker

```bash
# 构建
docker build -t trading-tracker-oss:local .

# 运行（env-var 模式）
docker run --rm -p 8080:8080 \
  -e TRADING_TRACKER_SUBSTREAMS_ENDPOINT=https://mainnet.sol.streamingfast.io:443 \
  -e TRADING_TRACKER_SUBSTREAMS_API_KEY="$SF_API_KEY" \
  -e TRADING_TRACKER_SOLANA_RPC=https://api.mainnet-beta.solana.com \
  -e TRADING_TRACKER_START_BLOCK=300000000 \
  -e TRADING_TRACKER_SUBSTREAMS_PACKAGE=/app/substreams/solana-dex-trades.spkg \
  -v "$PWD/substreams:/app/substreams:ro" \
  -v tracker-data:/app/data \
  trading-tracker-oss:local
```

### C — docker-compose（推荐生产入门）

见 `docker-compose.example.yml`。复制到 `docker-compose.yml` 并补 `config.toml` + `substreams/*.spkg`，然后：

```bash
docker compose up -d
docker compose logs -f trading-tracker
```

## 配置优先级

1. `TRADING_TRACKER_CONFIG=/path/to/x.toml` —— 显式路径
2. `./config.toml` —— 当前目录
3. `TRADING_TRACKER_*` env vars —— 无配置文件时回退（见 `config.example.toml` 对照表）

## 运行时验证

```bash
# 跑全部测试（18/18）
cargo test

# 只跑集成测试
cargo test --test integration

# 仓库级别 CI（检查本项目 + 所有姊妹项目）
../../scripts/ci-check.sh rust
```

## 可观测性

- **日志**：`RUST_LOG=info,trading_tracker_oss=debug`。设 `TRADING_TRACKER_LOG_OUTPUT_FORMAT=json` 出 JSON 结构化日志给 Loki。
- **liveness**：`curl http://localhost:8080/` TCP 可达即存活。
- **readiness**：订阅者应该在秒级收到第一条价格；若数分钟无广播，说明 cursor 停滞——检查 substreams endpoint + .spkg 是否匹配。
- **metrics**（TODO）：Prometheus `/metrics` 端点预留在 Session 5。

## 与闭源 ELF 的对应关系

所有模块路径、类型名、方法名保持与 `_snapshot/reconstruction/trading-tracker/_skeleton/HUMAN_GUIDE.md` 记录的**完全一致**，便于：

1. 对照 Ghidra 反编译伪代码逐段实现
2. 将来生产环境可**平滑替换**闭源 ELF（只要配置和 RPC 协议兼容）

## 关键设计决策

| 决策 | 理由 |
|---|---|
| 用 `solana-pubkey` 代替完整 `solana-sdk` | 避免 `curve25519-dalek 3.x` → `zeroize<1.4` 与 `tonic/rustls` 的 `zeroize>=1.6` 冲突 |
| 用 `borsh` 代替 `anchor-lang` | 同样避开上述冲突链；wire format 100% 兼容 |
| 用 `tonic-build` + `protoc-bin-vendored` | 不依赖系统 `protoc`，开箱即用 |
| Protobuf 命名空间对齐 `sf.substreams.*` | 与闭源 ELF 的 `pb::sf::substreams::rpc::v2::*` 符号完全一致，便于逐符号对照 |
| `cargo check` 优先于功能完整 | Session 1 只保证能编译，业务逻辑在后续 Session 逐步填回 |
