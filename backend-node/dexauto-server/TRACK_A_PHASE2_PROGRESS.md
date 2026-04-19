# Track A Phase 2 — dexauto-server 端到端跑通

基线：2026-04-18

## ✅ 已完成

### 1. 基础设施（docker-run 启动）
- `dev-up.sh` / `dev-down.sh` — 用 plain `docker run` 起 **postgres 16** / **redis 7** / **clickhouse 24**（无 TLS）
- 验证 3 个服务都 reachable（pg_isready / redis PING / clickhouse /ping）
- 数据持久化到 `dexauto-pg-data` / `dexauto-redis-data` / `dexauto-ch-data` 卷

### 2. 配置补丁（让 dev 可用）
- `dev.env` — 指向本地 docker 服务，加 `DB_SSL=false` / `REDIS_TLS=false`
- `dev.secret.json` — pg/redis/clickhouse/firebase/kms 全填 dev placeholder（Firebase key 是真 RSA 2048，kms 是占位）
- `config/database.config.ts` — 支持 `DB_SSL=false` 彻底禁 TLS
- `config/redis.config.ts` — 支持 `REDIS_TLS=false` 彻底禁 TLS
- `config/configuration.ts` — 补上 `kmsRegion/kmsAccessKeyId/kmsSecretAccessKey/kmsKeyId`
- `modules/redis/redis.module.ts` — (1) 按 env 决定是否开 TLS，(2) 加 `Redis` 类 alias provider 让按类型注入可用

### 3. 模块 DI 修复（11 个错误，逐一排查）
- `geyser-subscriber.module.ts` — `AutomaticStrategySyncerModule` 加 `forwardRef`（破循环）
- `favorite.module.ts` — 补 `TokenModule` + `ConfigModule` + `AuthModule`
- `message-notifier.service.ts` — 补回 `@InjectPinoLogger` + `@InjectRepository` 装饰器（反编译丢失）
- `wallet.module.ts` — 补 `TokenModule`
- `trading/entities/tradingOrder.entity.ts` — 把 `@Entity` + `@Index` 从空子类 `TradingOrderEntity` 上移到 `TradingOrder`，删除子类
- `trading/trading.module.ts` — 改用 `TradingOrder`，补 `MessageNotifierModule` + `PositionMonitorModule`
- `transfer-syncer/transfer-syncer.module.ts` — 改用 `TradingOrder`，补 `TokenModule` + `MessageNotifierModule`
- `user/user.module.ts` — 补 `TradingModule`(forwardRef) + `TransferSyncerModule` + `AutomaticStrategyModule`(forwardRef)
- `app.module.ts` — 注册 `clickhouseConfig` 并导入 `ClickHouseModule`（全局）
- `auth.module.ts` — 改为 `@Global()`（AuthGuard 被众多 controller 使用，避免每模块都要显式 import）

### 4. 应用已启动到 `onModuleInit`
DI 完全通过，NestJS 模块图构建成功，开始跑 TypeORM 和各模块的 `onModuleInit` 钩子。

---

## 🎉 2026-04-18 21:23 启动成功

**`Nest application successfully started` + 51 routes mapped + HTTP 200 from `/api/v1/token/trending`**

### 最后补丁
- `tradingOrder.entity.ts` —— 手工按 `src/migrations/*TradingOrders*.ts` 的 SQL 重建全部 30 个 `@Column` 装饰器（类型/nullable/length 严格对齐）
- `src/migrations/*.ts` —— 30 个 migration 文件批量 `class X` → `export class X implements MigrationInterface`（原本没 export，TypeORM glob load 找不到它们）

### 运行时验证
```
$ curl http://127.0.0.1:3000/api/v1/token/trending
HTTP 200 in 0.018s
{"code":0,"data":[],"message":"success"}
```

### 已知剩余警告（不阻断启动）
- ~~`WebSocket connect ECONNREFUSED 127.0.0.1:18081`~~ **已解决** —— 加了 `dev-data-center.mjs` mock
- ~~12 个实体还有部分 `@Column` 装饰器可能丢失~~ **已澄清：无遗漏** —— 之前 `grep -c '^\s*@Column'` 无法匹配多行 `@Column({\n ...\n})` 装饰器，误报为缺失。用 Python AST-style 审计（前 12 行窗口找 `@Column/@PrimaryColumn` 任意变体）确认：**13/13 实体装饰器完整**，0 TypeORM `metadata not found` 运行时报错
- `@clickhouse/client` `host` 字段已废弃 → 改 `url` （warning，功能正常）

---

## 🎉 2026-04-18 23:42 端到端管道通了

增加 `dev-data-center.mjs` —— 用 `rpc-websockets` 实现的 mock 数据中心，生成合成的 Raydium AMM v4 SOL/USDC 交易，每 2 秒推送一次。

### 修复要点
- **URL 路径 → 命名空间**：`rpc-websockets` Server 从 `url.pathname` 派生命名空间。客户端连的是 `ws://host:port/ws`，所以 `register()` 和 `event()` 必须都传 `ns='/ws'`
- 否则方法调用返回 `Method not found` (JSON-RPC -32601)

### 验证链路
```
[mock-dc] listening on ws://0.0.0.0:18081 (tick=2000ms)
[mock-dc] subscribe id=sub-1 pools=all
[mock-dc] tick 3 trades → 1 subs  (每 2 秒持续推送)
```

dexauto-server 侧：
```
[StreamService] Data stream connection opened
[StreamService] Subscribed to dex trades
```

HTTP 端点同时正常：
```
$ curl http://127.0.0.1:3000/api/v1/token/trending
{"code":0,"data":[],"message":"success"}
```

### 启动命令（本地完整栈）
```bash
./dev-up.sh                              # 起 pg + redis + clickhouse
node dev-data-center.mjs &               # 起 mock 数据中心（:18081）
npm run start:dev                        # 起 dexauto-server（:3000）
```

---

## 🎉 2026-04-18 23:53 真 trading-tracker-oss 桥接完成

`dev-data-center.mjs` 升级为**双模**：
- 默认 synthetic mock（无依赖）
- 设 `TRADING_TRACKER_WS` + `BRIDGE_MINTS` → **桥接模式**（订阅 trading-tracker-oss 的 `trading_tracker_subscribe_token_price`，PoolPrice 翻译为 TradeData 后 re-emit）

新增 `dev-fake-tracker.mjs` —— 本地模拟 trading-tracker-oss 的 jsonrpsee 端（不依赖真 substreams/.spkg），方便做 3 级 CI 测试。

### 3 级端到端验证

```
dev-fake-tracker.mjs  (ws://127.0.0.1:18090, jsonrpsee wire)
         │
         │  trading_tracker_token_price notifications (PoolPrice)
         ▼
dev-data-center.mjs (bridge mode, ws://127.0.0.1:18081/ws)
         │
         │  dexTradesNotify (TradeData)
         ▼
dexauto-server:3000
   ├─ StreamService: "Subscribed to dex trades"
   ├─ 51 HTTP routes
   └─ curl /api/v1/token/trending → HTTP 200
```

### 关键修复
- `PoolPrice` JSON shape 直接由 `trading-tracker-oss` 的 `#[derive(Serialize)]` 产出；bridge 逐字段翻译
- 缺失字段（vault_balance/signer/tx_id）用 dev-safe placeholders 填充，注释里记录了生产侧的修法
- 指数回退重连（500ms → 30s）避免 fake-tracker 重启时 bridge 空转

### 启动三级栈（完整命令）

```bash
./dev-up.sh                                                                              # pg/redis/clickhouse
PORT=18090 node dev-fake-tracker.mjs &                                                   # 模拟 tracker
TRADING_TRACKER_WS=ws://127.0.0.1:18090 \
  BRIDGE_MINTS=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  node dev-data-center.mjs &                                                             # 桥接
npm run start:dev                                                                         # dexauto-server
```

生产替换：只需把 `PORT=18090 node dev-fake-tracker.mjs &` 换成 `trading-tracker ...` 真实启动即可，其余不变。

---

## 历史阻塞（已解决）：TypeORM 实体装饰器大规模缺失

反编译丢失了**所有实体字段的 `@Column` / `@PrimaryColumn` / `@CreateDateColumn` 等装饰器**。

### 报错
```
TypeORMError: Index "tx_uk" contains column that is missing in the entity (TradingOrder): txId
```

### 10 个实体需要补回装饰器

| 实体 | 字段数估计 |
|---|---:|
| `AutomaticStrategy.entity.ts` | ~20 |
| `AutomaticStrategyEvent.entity.ts` | ~15 |
| `AutomaticStrategyEventTx.entity.ts` | ~10 |
| `favorite.entity.ts` | ~6 |
| `notify.entity.ts` | ~10 |
| `tradingOrder.entity.ts` | **~50**（最复杂） |
| `tradingSetting.entity.ts` | ~15 |
| `tradingStrategy.entity.ts` | ~10 |
| `tradingStrategyItem.entity.ts` | ~10 |
| `user.entity.ts` | ~10 |

**总计 ~150-200 字段**需要按 `src/migrations/*.ts` 的 SQL 表定义推出正确的 `@Column({ type, nullable, ... })`。

### 可行方案

**A. 手动按 migration SQL 重建装饰器**（~1 个工作日）
- 每个实体对照 `src/migrations/<timestamp>-<name>.ts` 里的 `CREATE TABLE` 推断
- 自动化脚本可以做大部分（`recovered/decompile.js` 已有类似经验）
- 干净，一次做对

**B. 跳过 TypeORM 启动，转身先跑交易路径的单测**
- `npm test` 能暴露更多业务逻辑 bug
- 不依赖 DB，回报快
- 但长期还是要回来做 A

---

## 建议下一步

1. **先 A**（重建实体装饰器）—— 这是所有后续工作的前提，不做这步就永远跑不动真实查询
2. A 做完后再试 `npm run start:dev`，大概率能直接启起来
3. 启起来之后接 `trading-tracker-oss` 订阅价格 → 端到端演练

---

## 重启步骤备忘

```bash
cd /home/kai/桌面/55182/链上自动化交易源码/backend-node/dexauto-server

# 1) 起服务
./dev-up.sh

# 2) 启动 app（watch 模式）
npm run start:dev

# 3) 关闭
./dev-down.sh               # 保留卷
./dev-down.sh --purge       # 连卷一起删
```
