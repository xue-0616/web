# `apple-public-key-monitor-oss`

**开源重写版** `apple-public-key-monitor` —— 替代
`backend-bin/apple-id-public-key/apple-public-key-monitor` 这个闭源 Rust ELF。

## 做什么

周期性拉取 Apple 的 [JWKS 端点](https://developer.apple.com/documentation/signinwithapplerestapi/fetch_apple_s_public_key_for_verifying_token_signature)，对比 `kid` 集合变化，变化时通过 Slack webhook 告警。

```
┌──────────┐  GET /auth/keys   ┌──────────────┐  JSON webhook   ┌───────┐
│  Apple   │───────────────────│ apple-key-   │─────────────────│ Slack │
│  JWKS    │◄──────────────────│  monitor     │                 │       │
└──────────┘                   └──────────────┘                 └───────┘
                                    │
                                    │ atomic save on change
                                    ▼
                              ┌──────────────┐
                              │ STATE_FILE   │
                              └──────────────┘
```

## 状态

✅ 20/20 测试通过（17 unit + 3 integration with wiremock）
✅ `cargo check` 全绿
✅ `docker build` 产 ~15 MB 运行时镜像

## 与闭源 ELF 的差异

| 维度 | 闭源 ELF | 本实现 |
|---|---|---|
| **Slack webhook** | 硬编码在 rodata | `SLACK_WEBHOOK_URL` env var，缺失即拒启动 |
| **轮询间隔** | 固定 | `POLL_INTERVAL_SECS`，默认 300 |
| **状态持久化** | 隐式用 CWD | `STATE_FILE`，默认 `./apple-keys.state.json`，**atomic save** (tmp + rename) |
| **首次启动行为** | 会 Slack 告警（假阳性） | 静默 seed，不触发告警 |
| **TLS 栈** | OpenSSL | rustls（无动态链接） |

## 配置

所有通过 env var 配置：

| Var | 默认 | 说明 |
|---|---|---|
| `SLACK_WEBHOOK_URL` | **required** | Slack incoming webhook |
| `APPLE_KEYS_URL` | `https://appleid.apple.com/auth/keys` | JWKS 端点 |
| `POLL_INTERVAL_SECS` | `300` | 两次 poll 间隔 |
| `STATE_FILE` | `./apple-keys.state.json` | 快照持久化路径 |
| `HTTP_TIMEOUT_SECS` | `30` | 每请求超时 |
| `LOG_OUTPUT_FORMAT` | `pretty` | 设 `json` 出结构化日志 |
| `RUST_LOG` | `info` | tracing-subscriber filter |

## 运行

```bash
# 裸机
SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...' \
  cargo run --release

# Docker
docker build -t apple-key-monitor:local .
docker run -d --name apple-key-monitor \
  -e SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...' \
  -v apple-key-state:/app/data \
  apple-key-monitor:local
```

## 关键不变量（生产就绪的基石）

1. **Slack 发送失败不阻止快照保存** —— 否则 Slack 暂时不可达会导致后续每次 tick 都重复告警
2. **原子写** —— 快照总是先写 `<path>.tmp` 再 `rename()`，防止崩溃中断写入留下半损 JSON
3. **损坏快照硬错** —— 半损 JSON 不静默降级为"空"，而是启动报错（操作员告警）
4. **首次运行静默** —— 新部署或清理 state file 后，只 seed 不告警（防假阳性）

## 仓库内相关文件

- `@/home/kai/桌面/55182/链上自动化交易源码/backend-bin/apple-id-public-key/apple-public-key-monitor` —— 要替换的闭源 ELF
- `@/home/kai/桌面/55182/链上自动化交易源码/backend-bin/apple-id-public-key/_recovery/` —— Ghidra 反编译提取的符号/crate 清单（用于验证行为一致性）
