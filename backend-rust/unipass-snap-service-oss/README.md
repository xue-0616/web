# `unipass-snap-service-oss`

**开源重写版**。替代 `backend-bin/unipass-snap-service/snap-server`
（26 MB 闭源 Rust ELF：actix-web + sqlx MySQL + deadpool_redis + jsonwebtoken + ethers + free-quota 签名）。

## 架构

```
   MetaMask Snap / Google OAuth
         │   (wallet address or Google sub)
         ▼
   ┌─────────────────────────┐          ┌──────────┐
   │  snap-server (this)     │──────────│ Custody  │
   │  actix-web + JWT auth   │ relay    │ Relayer  │
   │  free-quota signer      │          └──────────┘
   └───────┬──────────┬──────┘
           │          │
       MySQL         Redis
 (snap_account,   (login_challenge keys)
  snap_account_
  transaction)
```

## 完成度

✅ **37/37 测试通过**（config 8 + common 5 + auth 5 + contract 6 + error 5 + daos 1 + mq 1 + api 6）

| 层级 | 状态 |
|---|---|
| Cargo crate + deps | ✅ |
| SQL migrations（2 表，完整列定义从 ELF 提取） | ✅ |
| config（7 struct，HS256/signer 校验、mysql URL 编码） | ✅ |
| common enums（ProviderType/GuideStatus/TxStatus + TryFrom） | ✅ |
| error + actix ResponseError | ✅ |
| JWT issuer + verify（zero leeway） | ✅ |
| Free-quota signer（ERC abi.encode + keccak + ecsignature） | ✅ |
| Redis 登录挑战（set_ex + GETDEL 原子一次性） | ✅ |
| sqlx DAOs（两表 + CRUD + insert_ignore + 带状态过渡） | ✅ 结构 |
| actix-web HTTP（7 端点：health/login_challenge/login/me/guide/tx_prepare/tx_history） | ✅ 全 wired |
| main.rs（DI + SIGTERM） | ✅ |
| Dockerfile / README / CI | ✅ |
| 🟡 `login` 端点的 signature recovery | TODO：用 `ethers_core::Signature::recover` 补完 |
| 🟡 relayer outbound（把 tx 交给链下 relayer） | TODO：reqwest-retry 包一层 |

## 7 个 HTTP 端点

| 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| GET | `/healthz` | none | liveness |
| POST | `/v1/account/login_challenge` | none | 给 wallet 发放 nonce |
| POST | `/v1/account/login` | none | 交换签名和 JWT |
| GET | `/v1/account/me` | JWT | 读当前账户 |
| POST | `/v1/account/guide_status` | JWT | 标记引导完成 |
| POST | `/v1/tx/prepare` | JWT | 签发 free_sig |
| GET | `/v1/tx/history` | JWT | 分页交易历史 |

## 关键安全不变量

1. **Challenge 一次性**：Redis `GETDEL` 保证同一 nonce 不能重放（对应登录端点的 one-shot 模式）
2. **JWT zero-leeway**：过期即拒（无 60s 容忍）
3. **free_sig 跨 chain/nonce 隔离**：6 个确定性测试守护 hash 不变量
4. **Signer private key 启动期校验**：32 字节 hex，缺失即拒启动
5. **敏感字段不在错误响应中返回**：Error envelope 只含 status_code + message，不序列化内部 db/redis 错误细节
