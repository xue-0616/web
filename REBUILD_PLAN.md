# Web3 自动化交易平台 — 完整重建计划

## 一、系统架构概览

```
                    ┌──────────┐
                    │  Nginx   │ :80/:443
                    └────┬─────┘
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼────┐  ┌──────▼─────┐  ┌────▼──────┐
    │ 前端站点  │  │  API 网关   │  │ WebSocket │
    │ React/Vue│  │ /api/*     │  │  数据中心  │
    └──────────┘  └──────┬─────┘  └───────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼──────┐  ┌─────────▼──────┐  ┌──────────▼───┐
│ NestJS   │  │  Rust 服务     │  │  Rust 服务   │
│ 后端 x10 │  │ (交易/排序)    │  │ (支付/钱包)  │
└───┬──────┘  └────────┬───────┘  └──────┬───────┘
    │                  │                 │
┌───▼──────────────────▼─────────────────▼───┐
│  MySQL 8.0 │ PostgreSQL 15 │ Redis 7 │ CK  │
└────────────────────────────────────────────┘
```

## 二、服务器要求

| 资源 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 4 核 | 8 核 |
| 内存 | 16 GB | 32 GB |
| 磁盘 | 100 GB SSD | 200 GB SSD |
| OS | Ubuntu 22.04 / Debian 12 | 同左 |
| 网络 | 公网 IP, 开放 80/443 | 同左 |

所需软件:
- Docker 24+ & Docker Compose v2
- Rust 1.75+ (编译 Rust 服务)
- Node.js 18 LTS (编译 NestJS 服务)
- Nginx (已在 Docker Compose 中)

---

## 三、重建步骤（按优先级排序）

### Phase 1: 基础设施（Day 1）

#### 1.1 启动数据库和中间件

直接用现有 `docker-compose.yml` 中的基础设施部分：

```bash
# 只启动数据库和中间件
docker compose up -d mysql postgres redis clickhouse
```

数据库凭证（已在 .env.production 中）:
- MySQL: `root / W3b3_MySQL_2026!Prod` → port 13306
- PostgreSQL: `web3admin / W3b3_PG_2026!Prod` → port 15432
- Redis: `W3b3_Redis_2026!Prod` → port 16379
- ClickHouse: `web3admin / W3b3_CK_2026!Prod` → port 18123

#### 1.2 创建数据库 Schema

需要创建以下数据库：

| 数据库 | 引擎 | 用途 | Schema 来源 |
|--------|------|------|------------|
| dexauto | PostgreSQL | DEX自动交易 | 从 NestJS TypeORM migration 生成 |
| utxoswap | PostgreSQL | UTXO Swap 排序器 | 从 Rust sea-orm migration 生成 |
| huehub | MySQL | HueHub DEX | 从 NestJS TypeORM migration 生成 |
| dexauto (CK) | ClickHouse | 交易数据分析 | 需从代码推断建表语句 |

**操作方式**: 各 NestJS 服务启动时会自动通过 TypeORM `synchronize: true` 或 migration 创建表。Rust 服务需要手动运行 sea-orm migration。

---

### Phase 2: 核心 Rust 服务编译部署（Day 1-2）

这些是交易系统的核心，必须最先搞定。

#### 2.1 安装 Rust 工具链

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable
```

#### 2.2 编译核心 Rust 服务

| 优先级 | 服务 | 源码路径 | 端口 | 依赖 |
|--------|------|---------|------|------|
| P0 | utxo-swap-sequencer | backend-rust/utxo-swap-sequencer | 8080 | PostgreSQL, CKB RPC |
| P0 | dexauto-trading-server | backend-rust/dexauto-trading-server | 8080 | PostgreSQL, Redis, Solana RPC |
| P1 | payment-server | backend-rust/payment-server | 8080 | PostgreSQL, CKB RPC |
| P1 | utxoswap-farm-sequencer | backend-rust/utxoswap-farm-sequencer | 8080 | PostgreSQL, CKB RPC |
| P2 | unipass-wallet-relayer | backend-rust/unipass-wallet-relayer | 8080 | PostgreSQL, EVM RPC |
| P2 | unipass-bridge-validator | backend-rust/unipass-bridge-validator | 8080 | PostgreSQL |
| P2 | tss-ecdsa-server | backend-rust/tss-ecdsa-server | 8080 | 无外部依赖 |
| P3 | huehub-token-distributor | backend-rust/huehub-token-distributor | 8080 | CKB RPC |

每个服务编译方式：

```bash
cd backend-rust/<service>
cargo build --release
# 产出在 target/release/<binary_name>
```

#### 2.3 编写 Dockerfile（如果没有）

标准 Rust multi-stage Dockerfile:

```dockerfile
FROM rust:1.75-bookworm AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/<binary> /app/<binary>
WORKDIR /app
CMD ["./<binary>"]
```

---

### Phase 3: NestJS 后端服务（Day 2-3）

#### 3.1 可直接部署的服务（有 dist/ 编译产物）

这些服务已有编译好的 `dist/`，只需 `npm install` 安装依赖即可运行：

| 服务 | dist/ 文件数 | package.json | 状态 |
|------|-------------|-------------|------|
| dexauto-server | 136 | ✅ | npm install + node dist/main.js |
| huehub-dex-backend | 202 | ✅ | 同上 |
| huehub-dex-dobs-backend | 101 | ✅ | 同上 |
| btc-assets-api | 68 | ✅ | 同上 |
| mystery-bomb-box-backend | 55 | ✅ | 同上 |
| opentg-backend | 39 | ✅ | 同上 |
| solagram-backend | 112 | ✅ | 同上 |
| unipass-wallet-backend | 102 | ✅ | 同上 |
| utxoswap-paymaster-backend | 43 | ✅ | 同上 |
| unipass-activity-backend | 42 | ✅ | 同上（有恢复的src/可重新编译） |
| unipass-wallet-oauth | 68 | ✅ | 同上（有恢复的src/可重新编译） |

每个服务的运行步骤：

```bash
cd backend-node/<service>
npm install --production
node dist/main.js
```

标准 Dockerfile:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY dist/ dist/
CMD ["node", "dist/main.js"]
```

#### 3.2 需要额外处理的服务

| 服务 | 问题 | 解决方案 |
|------|------|---------|
| unipass-cms-backend | 无 package.json, 无 dist/ | 需从类似 NestJS 项目推断依赖重建 |
| unipass-snap-service | 仅 Rust binary | 直接使用 binary 或从 Harbor 拉镜像 |
| dexauto-data-center | Go binary (Substreams) | 直接使用 binary 或从 Harbor 拉镜像 |

---

### Phase 4: 前端站点（Day 3-4）

#### 4.1 有完整源码的站点（可 npm build）

| 站点 | 文件数 | 框架 |
|------|--------|------|
| auto-dex-site | 1262 | React (Vite) |
| unipass-app-h5 | 103 | |
| unipass-cms-frontend | 256 | |
| unipass-payment-web | 63 | |
| unipass-snap-frontend | 153 | |
| solagram-web-site | 37 | |

```bash
cd frontend/<site>
npm install
npm run build
# 产出在 dist/ 或 build/ 目录
```

#### 4.2 仅有构建产物的站点（直接用 Nginx 托管）

| 站点 | 说明 |
|------|------|
| utxo-swap-site | 15 个静态文件, Nginx 直接服务 |
| huehub-dex-site | 15 个静态文件 |
| unipass-wallet-frontend | 277 个 Vue 构建文件 |
| unipass-wallet-official-website | 73 个静态文件 |

Nginx 托管 Dockerfile:

```dockerfile
FROM nginx:alpine
COPY ./dist /usr/share/nginx/html
```

---

### Phase 5: 配置和联调（Day 4-5）

#### 5.1 环境变量配置

每个服务需要的关键环境变量：

| 变量 | 用途 | 当前值/状态 |
|------|------|------------|
| SOLANA_RPC_URL | Solana 主网 RPC | ✅ 有 Helius key |
| CKB_RPC_URL | CKB 节点 | ⚠️ 指向 157.245.147.148:8114（可能失效） |
| ETH_RPC_URL | 以太坊 RPC | ✅ 有 Alchemy key |
| CMC_API_KEY | 行情数据 | ✅ 有 |
| AWS KMS | 钱包密钥加密 | ⚠️ 需要有效 AWS 账户 |
| FIREBASE | 推送通知 | ⚠️ 需要 credentials JSON |
| JWT_SECRET | 认证 | 需新生成 |

#### 5.2 各服务的特殊配置

**dexauto-server** (核心交易后端):
- 需要 `SECRET_PATH` 指向一个包含交易密钥的 JSON
- 需要 `DATA_CENTER_WS` WebSocket 连接

**utxo-swap-sequencer** (UTXO DEX 排序器):
- 需要 CKB sequencer 私钥（管理链上资金的关键密钥）
- `DATABASE_URL` 指向 PostgreSQL

**trading-server** (Solana 交易引擎):
- 需要 Solana operator 私钥
- 需要 `SOLANA_RPC_URL`

#### 5.3 Nginx 反向代理

`nginx.conf` 已经配好，路由规则：
- `/api/dexauto/*` → dexauto-server:3000
- `/api/trading/*` → trading-server:8080
- `/api/btc-assets/*` → btc-assets-api:3000
- `/api/data/*` → dexauto-data-center:3000
- `/api/huehub/*` → huehub-dex-backend:3000
- `/api/utxo/*` → utxo-swap-sequencer:8080
- `/dex/*` → auto-dex-site:3000
- `/` → huehub-dex-site:3000

---

## 四、两种部署路径

### 路径 A: 直接拉 Harbor 镜像（最快，1-2小时）

原始镜像还在 `188.166.243.240` 上，可以直接拉取运行：

```bash
# 配置 Docker 信任 Harbor 自签证书
# 然后 docker login 188.166.243.240 -u admin -p Harbor12345
# 修改 docker-compose.yml 直接启动
docker compose up -d
```

**优点**: 最快，镜像已编译好
**缺点**: 依赖外部 Harbor 可用性，无法修改代码

### 路径 B: 从源码完整重建（3-5天）

1. 在服务器安装 Rust + Node.js
2. 逐个编译 8 个 Rust 服务
3. 逐个 npm install 11 个 NestJS 服务
4. 构建 6 个前端站点
5. 编写 Dockerfile、构建镜像
6. 修改 docker-compose.yml 指向本地镜像
7. 配置环境变量，启动全套服务

**优点**: 完全自主可控，可以修改代码
**缺点**: 耗时较长，可能遇到编译问题

### 路径 C: 混合方案（推荐，2-3天）

1. 能从源码编译的 → 从源码构建
2. 只有 binary 的 (data-center, snap-service) → 从 Harbor 拉镜像
3. 前端构建产物 → 直接 Nginx 托管
4. 先用 `docker compose` 跑通核心服务，再逐步替换

---

## 五、已知风险和阻塞点

| 风险 | 严重度 | 说明 |
|------|--------|------|
| CKB RPC 节点失效 | 高 | 157.245.147.148 可能不可用，需自建或找替代 |
| Solana RPC 限流 | 中 | Helius free tier 可能不够生产用 |
| AWS KMS 密钥 | 高 | 钱包加密依赖 AWS KMS，需有效账户 |
| 数据库 Schema 不完整 | 中 | Rust 服务的 migration 需要补充 |
| dexauto-data-center 无源码 | 中 | Go Substreams 服务只有 binary，无法修改 |
| 链上私钥缺失 | 高 | sequencer/operator 的链上私钥是核心资产，需要新生成 |
| Firebase credentials | 低 | 推送通知功能，非核心 |

---

## 六、最小可运行子集（MVP）

如果只想先跑通核心交易功能，最少需要：

1. **PostgreSQL** + **Redis** ← 基础设施
2. **dexauto-server** ← 交易策略管理 API
3. **dexauto-trading-server** (Rust) ← Solana 交易执行引擎
4. **auto-dex-site** ← 前端 UI
5. **Nginx** ← 反向代理

这 5 个组件就能跑通 Solana DEX 自动交易的核心流程。

如果还需要 CKB/UTXO 交易：
6. **utxo-swap-sequencer** (Rust) ← CKB UTXO 排序器
7. **btc-assets-api** ← BTC 资产 API

---

## 七、下一步行动

- [ ] 确定部署服务器
- [ ] 确认 RPC 节点可用性 (Solana/CKB/EVM)
- [ ] 生成新的链上密钥对
- [ ] 从源码编译 Rust 核心服务
- [ ] npm install NestJS 服务
- [ ] 修改 docker-compose.yml 指向本地构建的镜像
- [ ] 启动并联调
