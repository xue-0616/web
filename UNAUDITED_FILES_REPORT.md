# 未审计源文件完整报告 (Unaudited Source Files Report)

> Generated: 2026-04-16
> Scope: All backend-node and backend-rust projects
> Excludes: node_modules, dist, target, migrations, entities/models (DB schema), test files, config/module boilerplate (*.module.ts, *.entity.ts, *.dto.ts, *.interface.ts)

---

## 1. huehub-dex-backend (Node.js)

**Audited:** `order.service.ts`, `mint.history.db.service.ts`, `ckb-deploy-cell-provider.service.ts`

### ❌ UNAUDITED Service/Controller/Handler Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `src/modules/btc/btc.assets.service.ts` | BTC asset querying/management service |
| 2 | `src/modules/btc/btc.controller.ts` | BTC module REST controller |
| 3 | `src/modules/btc/btc.service.ts` | Core BTC transaction/business logic |
| 4 | `src/modules/ckb/rgbpp-distributor.service.ts` | RGB++ token distribution logic |
| 5 | `src/modules/ckb/transaction-builder.ts` | CKB transaction construction logic |
| 6 | `src/modules/external/external.controller.ts` | External API integration controller |
| 7 | `src/modules/external/external.service.ts` | External API integration service |
| 8 | `src/modules/launchpad/db.service/index.ts` | Launchpad DB service barrel export |
| 9 | `src/modules/launchpad/db.service/launchpad.rounds.db.service.ts` | Launchpad round DB operations |
| 10 | `src/modules/launchpad/db.service/launchpad.tokens.db.service.ts` | Launchpad token DB operations |
| 11 | `src/modules/launchpad/db.service/whitelist.db.service.ts` | Whitelist management for launchpad |
| 12 | `src/modules/launchpad/issue.controller.ts` | Token issuance controller |
| 13 | `src/modules/launchpad/launchpad.controller.ts` | Launchpad main controller |
| 14 | `src/modules/launchpad/launchpad.service.ts` | Launchpad core business logic |
| 15 | `src/modules/launchpad/launchpad.task.service.ts` | Launchpad scheduled/background tasks |
| 16 | `src/modules/launchpad/launchpad.transaction.service.ts` | Launchpad transaction building/sending |
| 17 | `src/modules/launchpad/processor/launchpad.processor.ts` | Launchpad job queue processor |
| 18 | `src/modules/rgbpp/asset/asset.service.ts` | RGB++ asset management service |
| 19 | `src/modules/rgbpp/asset.collector.ts` | RGB++ asset collection/indexing |
| 20 | `src/modules/rgbpp/ckb/ckb.explorer.api.service.ts` | CKB Explorer API integration |
| 21 | `src/modules/rgbpp/fix.controller.ts` | Data fix/repair controller |
| 22 | `src/modules/rgbpp/indexer.service.ts` | RGB++ indexer service |
| 23 | `src/modules/rgbpp/order/item.service.ts` | Order item management |
| 24 | `src/modules/rgbpp/processor/rgbpp.processor.ts` | RGB++ job queue processor |
| 25 | `src/modules/rgbpp/rgbpp.controller.ts` | RGB++ main controller |
| 26 | `src/modules/rgbpp/rgbpp.service.ts` | RGB++ core business logic |
| 27 | `src/modules/rgbpp/tasks.service.ts` | RGB++ scheduled tasks |
| 28 | `src/modules/rgbpp/tokens/deployment.token.service.ts` | Token deployment management |
| 29 | `src/modules/rgbpp/tokens/market.tokens.service.ts` | Market token listing logic |
| 30 | `src/modules/rgbpp/tokens/token.mint.service.ts` | Token minting logic |
| 31 | `src/modules/rgbpp/tokens/tokens.service.ts` | Token CRUD/management |
| 32 | `src/modules/rgbpp/tokens/token.statistic.service.ts` | Token statistics computation |
| 33 | `src/modules/user/user.controller.ts` | User management controller |
| 34 | `src/modules/user/user.service.ts` | User management service |

### ❌ UNAUDITED Utility/Crypto Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 35 | `src/common/utils/ckb.tx.ts` | CKB transaction helper utilities |
| 36 | `src/common/utils/ckb.virtual.tx.ts` | CKB virtual transaction builder |
| 37 | `src/common/utils/deterministic-ecdsa.ts` | Deterministic ECDSA signing |
| 38 | `src/common/utils/ecdsa.ts` | ECDSA cryptographic operations |
| 39 | `src/common/utils/launch.collector.ts` | Launch data collection utility |
| 40 | `src/common/utils/launch.commitment.ts` | Launch commitment hash generation |
| 41 | `src/common/utils/launch.ts` | Launchpad helper functions |
| 42 | `src/common/utils/mint.ts` | Minting helper functions |
| 43 | `src/common/utils/typehash.validator.ts` | Type hash validation logic |
| 44 | `src/common/utils/tools.ts` | General utility functions |
| 45 | `src/common/utils-service/http.service.ts` | HTTP request wrapper service |
| 46 | `src/common/utils-service/redlock.service.ts` | Distributed lock service |
| 47 | `src/common/throttler/global.throttler.storage.ts` | Rate limiting storage |
| 48 | `src/auth/jwt.strategy.ts` | JWT authentication strategy |

**Total unaudited business logic files: ~48**

---

## 2. unipass-cms-backend (Node.js)

**Audited:** `transaction.service.ts`, `login.service.ts`

### ❌ UNAUDITED Service/Controller Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `src/modules/admin/account/account.controller.ts` | Admin account management controller |
| 2 | `src/modules/admin/login/login.controller.ts` | Admin login controller |
| 3 | `src/modules/admin/system/dept/dept.controller.ts` | Department management controller |
| 4 | `src/modules/admin/system/dept/dept.service.ts` | Department CRUD service |
| 5 | `src/modules/admin/system/log/log.controller.ts` | System log controller |
| 6 | `src/modules/admin/system/log/log.service.ts` | System log query service |
| 7 | `src/modules/admin/system/menu/menu.controller.ts` | Menu/permission controller |
| 8 | `src/modules/admin/system/menu/menu.service.ts` | Menu management service |
| 9 | `src/modules/admin/system/online/online.controller.ts` | Online user management controller |
| 10 | `src/modules/admin/system/online/online.service.ts` | Online user tracking service |
| 11 | `src/modules/admin/system/param-config/param-config.controller.ts` | System config controller |
| 12 | `src/modules/admin/system/param-config/param-config.service.ts` | System configuration CRUD |
| 13 | `src/modules/admin/system/role/role.controller.ts` | Role management controller |
| 14 | `src/modules/admin/system/role/role.service.ts` | Role/permission CRUD service |
| 15 | `src/modules/admin/system/serve/serve.controller.ts` | Server status controller |
| 16 | `src/modules/admin/system/serve/serve.service.ts` | Server monitoring service |
| 17 | `src/modules/admin/system/task/task.controller.ts` | Scheduled task controller |
| 18 | `src/modules/admin/system/task/task.processor.ts` | Task queue processor |
| 19 | `src/modules/admin/system/task/task.service.ts` | Task scheduling service |
| 20 | `src/modules/admin/system/user/user.controller.ts` | System user management controller |
| 21 | `src/modules/admin/system/user/user.service.ts` | System user CRUD service |
| 22 | `src/modules/unipass/ap/action-point.issue.controller.ts` | Action point issuance controller |
| 23 | `src/modules/unipass/ap/action-point.issue.service.ts` | Action point issuance logic |
| 24 | `src/modules/unipass/chain/mock.ts` | Chain mock/testing utilities |
| 25 | `src/modules/unipass/chain/query-abi.service.ts` | On-chain ABI query service |
| 26 | `src/modules/unipass/chain/utils.ts` | Chain interaction utilities |
| 27 | `src/modules/unipass/elastic.service.ts` | Elasticsearch integration service |
| 28 | `src/modules/unipass/monitor/account.evnets.ts` | Account event monitoring |
| 29 | `src/modules/unipass/monitor/dkim.service.ts` | DKIM email verification service |
| 30 | `src/modules/unipass/monitor/monitor.controller.ts` | Monitoring dashboard controller |
| 31 | `src/modules/unipass/monitor/open.id.service.ts` | OpenID integration service |
| 32 | `src/modules/unipass/order/order.controller.ts` | Order management controller |
| 33 | `src/modules/unipass/order/order.service.ts` | Order processing service |
| 34 | `src/modules/unipass/order/utils.ts` | Order utility functions |
| 35 | `src/modules/unipass/payment_snap/server/base-statistics.server.ts` | Base statistics computation |
| 36 | `src/modules/unipass/payment_snap/server/payment-snap-gas.server.ts` | Payment gas estimation service |
| 37 | `src/modules/unipass/payment_snap/server/payment-tx.server.ts` | Payment transaction service |
| 38 | `src/modules/unipass/payment_snap/server/register-statistics.servier.ts` | Registration statistics service |
| 39 | `src/modules/unipass/payment_snap/server/snap-app-db.service.ts` | Snap app database service |
| 40 | `src/modules/unipass/payment_snap/statistics.controller.ts` | Statistics API controller |
| 41 | `src/modules/unipass/payment_snap/utils/payment-snap-gas.utils.ts` | Gas payment calculation utils |
| 42 | `src/modules/unipass/payment_snap/utils/payment-tx.utils.ts` | Payment transaction building utils |
| 43 | `src/modules/unipass/payment_snap/utils/register-statistics.utils.ts` | Registration stats utils |
| 44 | `src/modules/unipass/payment_snap/utils/transaction.utils.ts` | Transaction building utilities |
| 45 | `src/modules/unipass/relayer/gas.statistics.service.ts` | Relayer gas statistics service |
| 46 | `src/modules/unipass/relayer/relayer.service.ts` | Transaction relayer service |
| 47 | `src/modules/unipass/statistics.service.ts` | Global statistics service |
| 48 | `src/modules/unipass/unipass.controller.ts` | Unipass main controller |
| 49 | `src/modules/unipass/unipass.service.ts` | Unipass main service |
| 50 | `src/modules/ws/admin-ws.gateway.ts` | WebSocket gateway for admin |
| 51 | `src/modules/ws/admin-ws.service.ts` | Admin WebSocket service |
| 52 | `src/modules/ws/auth.service.ts` | WebSocket authentication service |
| 53 | `src/modules/ws/socket-io.adapter.ts` | Socket.IO adapter |
| 54 | `src/mission/jobs/http-request.job.ts` | HTTP request background job |
| 55 | `src/mission/jobs/sys-log-clear.job.ts` | System log cleanup job |
| 56 | `src/shared/services/redis.service.ts` | Redis connection/operations service |
| 57 | `src/shared/services/up.http.service.ts` | UniPass HTTP client service |
| 58 | `src/shared/services/util.service.ts` | Shared utility service |
| 59 | `src/shared/services/api-config.service.ts` | API configuration service |

**Total unaudited business logic files: ~59**

---

## 3. solagram-backend (Node.js)

**Audited:** `blink.service.ts`, `wallet.controller.ts`, `wallet.service.ts`, `user-key-encrypted-db.service.ts`

### ❌ UNAUDITED Service/Controller Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `src/auth/auth.service.ts` | Authentication/JWT service |
| 2 | `src/modules/blink/blink.controller.ts` | Blink (Solana Actions) controller |
| 3 | `src/modules/blink/blink-short-code-db.service.ts` | Short code DB operations for blinks |
| 4 | `src/modules/blink/parse.blink.service.ts` | Blink URL parsing service |
| 5 | `src/modules/bot-statistics/bot-statistics.service.ts` | Telegram bot statistics service |
| 6 | `src/modules/bot-statistics/db/bot-group-db.service.ts` | Bot group DB service |
| 7 | `src/modules/bot-statistics/db/bot-reply-blink-db.service.ts` | Bot blink reply DB service |
| 8 | `src/modules/bot-statistics/db/open-app-action-db.service.ts` | Open app action tracking DB |
| 9 | `src/modules/bot-statistics/db/tg-sol-address.service.ts` | Telegram-Solana address mapping |
| 10 | `src/modules/bot-statistics/db/tg-user-db.service.ts` | Telegram user DB service |
| 11 | `src/modules/bot-statistics/db/user-follow-db.service.ts` | User follow relationship DB |
| 12 | `src/modules/notify/notify.controller.ts` | Push notification controller |
| 13 | `src/modules/notify/notify.service.ts` | Push notification service |
| 14 | `src/modules/solana/solana.controller.ts` | Solana RPC proxy controller |
| 15 | `src/modules/solana/solana.service.ts` | Solana blockchain interaction service |
| 16 | `src/modules/tg-bot/message.service.ts` | Telegram bot message handling |
| 17 | `src/modules/tg-bot/tg-bot.service.ts` | Telegram bot core service |
| 18 | `src/modules/tg-bot/webhook.controller.ts` | Telegram webhook controller |
| 19 | `src/modules/tg-user/aws-user.service.ts` | AWS user integration (key management) |
| 20 | `src/modules/tg-user/mini-app.controller.ts` | Telegram Mini App controller |
| 21 | `src/modules/tg-user/tg-user.controller.ts` | Telegram user management controller |
| 22 | `src/modules/tg-user/tg-user.service.ts` | Telegram user management service |
| 23 | `src/modules/wallet/app.controller.ts` | App-level wallet controller |
| 24 | `src/common/utils/action/actions-spec.ts` | Solana Actions specification impl |
| 25 | `src/common/utils/action/action.ts` | Action execution logic |
| 26 | `src/common/utils/action/interstitial-url.ts` | Interstitial URL handling |
| 27 | `src/common/utils/action/url-mapper.ts` | URL routing/mapping for actions |
| 28 | `src/common/utils/aws.command.ts` | AWS SDK command wrappers |
| 29 | `src/common/utils/bot.tools.ts` | Bot utility functions |
| 30 | `src/common/utils/tools.ts` | General utility functions |
| 31 | `src/common/utils-service/http.service.ts` | HTTP request service |
| 32 | `src/common/utils-service/redlock.service.ts` | Distributed lock service |

**Total unaudited business logic files: ~32**

---

## 4. unipass-wallet-backend (Node.js)

**Audited:** `mycrypto.ts`, `account.controller.ts`, `key.service.ts`, `receive-email.service.ts`, `redis.service.ts`, `api-config.service.ts`

### ❌ UNAUDITED Service/Controller Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `src/modules/account/account.service.ts` | Account registration/management service |
| 2 | `src/modules/account/controller/config.controller.ts` | Wallet config API controller |
| 3 | `src/modules/account/controller/otp.controller.ts` | OTP verification controller |
| 4 | `src/modules/account/processor/account.processor.ts` | Account operation queue processor |
| 5 | `src/modules/account/processor/tx.processor.ts` | Transaction queue processor |
| 6 | `src/modules/account/service/accounts.db.service.ts` | Account DB CRUD service |
| 7 | `src/modules/account/service/account.transaction.service.ts` | Account transaction service |
| 8 | `src/modules/account/service/guardian.service.ts` | Social recovery guardian service |
| 9 | `src/modules/account/service/key.db.service.ts` | Key storage DB service |
| 10 | `src/modules/account/service/ori.hash.db.service.ts` | Original hash DB service |
| 11 | `src/modules/otp/otp.service.ts` | OTP generation/validation service |
| 12 | `src/modules/otp/processor/send.code.processor.ts` | OTP code sending processor |
| 13 | `src/modules/otp/service/otp.base.service.ts` | OTP base service logic |
| 14 | `src/modules/otp/service/send.email.service.ts` | Email sending service for OTP |
| 15 | `src/modules/receive-email/receive-email.controller.ts` | Email receipt controller |
| 16 | `src/shared/services/email.service.ts` | Email dispatch service |
| 17 | `src/shared/services/logger.service.ts` | Logging service |
| 18 | `src/shared/services/validator.service.ts` | Input validation service |
| 19 | `src/shared/utils/email.dkim.ts` | DKIM email signing utility |
| 20 | `src/shared/utils/email.templat.ts` | Email template utilities |
| 21 | `src/shared/utils/tx.sig.ts` | Transaction signature utilities |
| 22 | `src/shared/utils/unipass.tx.executor.ts` | UniPass transaction executor |
| 23 | `src/shared/utils/wallet.ts` | Wallet utility functions |
| 24 | `src/mock/cloud-key.ts` | Cloud key mock (may contain key logic) |

**Total unaudited business logic files: ~24**

---

## 5. btc-assets-api (Node.js)

**Audited:** `transaction.ts` (route), `paymaster.ts`, cron files

### ❌ UNAUDITED Route/Service Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `src/routes/bitcoin/address.ts` | BTC address query routes |
| 2 | `src/routes/bitcoin/block.ts` | BTC block query routes |
| 3 | `src/routes/bitcoin/fees.ts` | BTC fee estimation routes |
| 4 | `src/routes/bitcoin/info.ts` | BTC chain info routes |
| 5 | `src/routes/bitcoin/transaction.ts` | BTC transaction routes (may overlap) |
| 6 | `src/routes/rgbpp/address.ts` | RGB++ address query routes |
| 7 | `src/routes/rgbpp/assets.ts` | RGB++ asset query routes |
| 8 | `src/routes/rgbpp/spv.ts` | RGB++ SPV proof routes |
| 9 | `src/routes/rgbpp/transaction.ts` | RGB++ transaction routes |
| 10 | `src/routes/token/generate.ts` | Token generation routes |
| 11 | `src/routes/internal/job.ts` | Internal job management route |
| 12 | `src/routes/cron/unlock-cells.ts` | Cell unlocking cron job |
| 13 | `src/services/bitcoin/electrs.ts` | Electrs (BTC indexer) client |
| 14 | `src/services/bitcoin/mempool.ts` | Mempool monitoring service |
| 15 | `src/services/ckb.ts` | CKB chain interaction service |
| 16 | `src/services/spv.ts` | SPV proof service |
| 17 | `src/services/unlocker.ts` | Cell unlocker service |
| 18 | `src/hooks/admin-authorize.ts` | Admin authorization hook |
| 19 | `src/plugins/ip-block.ts` | IP blocking plugin |
| 20 | `src/plugins/rate-limit.ts` | Rate limiting plugin |
| 21 | `src/plugins/jwt.ts` | JWT authentication plugin |
| 22 | `src/utils/interceptors.ts` | Request/response interceptors |
| 23 | `src/utils/validators.ts` | Input validators |

**Total unaudited business logic files: ~23**

---

## 6. unipass-wallet-oauth (Node.js)

**Audited:** `oauth2.service.ts`, `oauth2.db.service.ts`

### ❌ UNAUDITED Service/Controller Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `src/modules/oauth2/oauth2.controller.ts` | OAuth2 REST controller |
| 2 | `src/modules/otp/ip.recaptcha.service.ts` | IP-based reCAPTCHA service |
| 3 | `src/modules/otp/processor/send.code.processor.ts` | OTP code sending processor |
| 4 | `src/modules/otp/service/otp.base.service.ts` | OTP base service logic |
| 5 | `src/modules/otp/service/send.email.service.ts` | Email sending service |
| 6 | `src/shared/services/email.service.ts` | Email dispatch service |
| 7 | `src/shared/services/redis.service.ts` | Redis operations service |
| 8 | `src/shared/services/up.http.service.ts` | UniPass HTTP client |
| 9 | `src/shared/services/validator.service.ts` | Input validation service |
| 10 | `src/shared/services/api-config.service.ts` | API config service |
| 11 | `src/shared/utils/utils.ts` | General utility functions |
| 12 | `src/shared/utils/email.templat.ts` | Email template utilities |

**Total unaudited business logic files: ~12**

---

## 7. mystery-bomb-box-backend (Node.js)

**Audited:** `transaction.service.ts`, `db.service.ts`

### ❌ UNAUDITED Service/Controller Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `src/modules/blink/action/action.controller.ts` | Blink action controller |
| 2 | `src/modules/blink/action/action.service.ts` | Blink action execution service |
| 3 | `src/modules/blink/blink.controller.ts` | Blink main controller |
| 4 | `src/modules/blink/blink.service.ts` | Blink main service |
| 5 | `src/modules/db/bot-notify/bot.notify.service.ts` | Bot notification DB service |
| 6 | `src/modules/db/grab-mystery-boxs.service.ts` | Mystery box grab DB service |
| 7 | `src/modules/db/mystery-boxs.service.ts` | Mystery box CRUD DB service |
| 8 | `src/modules/db/transaction-db.service.ts` | Transaction DB service |
| 9 | `src/modules/transaction/mystery.controller.ts` | Mystery box transaction controller |
| 10 | `src/common/utils/transaction.ts` | Transaction utility functions |
| 11 | `src/common/utils/tools.ts` | General utility functions |
| 12 | `src/common/utils-service/http.service.ts` | HTTP request service |
| 13 | `src/common/utils-service/redlock.service.ts` | Distributed lock service |
| 14 | `src/app.controller.ts` | Root app controller |

**Total unaudited business logic files: ~14**

---

## 8. payment-server (Rust)

**Audited:** `send.rs`, `submitter.rs`, `open_id_with_email_key.rs`, webhooks, invoice, shopping, fee, `no_sign_signer`, `price_oracle`

### ❌ UNAUDITED Handler/Service Files in crates/api/:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `crates/api/src/account/login.rs` | User login handler |
| 2 | `crates/api/src/account/recovery.rs` | Account recovery handler |
| 3 | `crates/api/src/account/register.rs` | User registration handler |
| 4 | `crates/api/src/account/update_backup.rs` | Backup key update handler |
| 5 | `crates/api/src/assets/assets_list.rs` | Asset listing handler |
| 6 | `crates/api/src/assets/estimated_fee.rs` | Fee estimation handler |
| 7 | `crates/api/src/assets/transaction.rs` | Asset transaction handler |
| 8 | `crates/api/src/auth_middleware.rs` | Authentication middleware |
| 9 | `crates/api/src/config_api.rs` | Config API handler |
| 10 | `crates/api/src/context.rs` | API context/state |
| 11 | `crates/api/src/history/notify_history.rs` | Notification history handler |
| 12 | `crates/api/src/payment/config.rs` | Payment configuration handler |
| 13 | `crates/api/src/payment/details.rs` | Payment details handler |
| 14 | `crates/api/src/ramp/off_ramp.rs` | Fiat off-ramp handler |
| 15 | `crates/api/src/ramp/on_ramp.rs` | Fiat on-ramp handler |
| 16 | `crates/api/src/rate_limiter.rs` | Rate limiting middleware |
| 17 | `crates/api/src/referral/invitation_statistics.rs` | Referral stats handler |
| 18 | `crates/api/src/referral/submit_invitation_code.rs` | Referral code submission handler |

### ❌ UNAUDITED Files in crates/api-utils/:

| # | File | Likely Purpose |
|---|------|----------------|
| 19 | `crates/api-utils/src/account_utils.rs` | Account utility functions |
| 20 | `crates/api-utils/src/activity_manager.rs` | User activity tracking |
| 21 | `crates/api-utils/src/alchemy_pay_manager/client.rs` | AlchemyPay API client |
| 22 | `crates/api-utils/src/alchemy_pay_manager/manager.rs` | AlchemyPay integration manager |
| 23 | `crates/api-utils/src/alchemy_pay_manager/sign_util.rs` | AlchemyPay signature utilities |
| 24 | `crates/api-utils/src/asset_migrator/client.rs` | Asset migration client |
| 25 | `crates/api-utils/src/asset_migrator/manager.rs` | Asset migration manager |
| 26 | `crates/api-utils/src/asset_migrator/transaction_consumer.rs` | Migration TX consumer |
| 27 | `crates/api-utils/src/asset_migrator/transaction_consumer_item.rs` | Migration TX consumer item |
| 28 | `crates/api-utils/src/chain_events/events.rs` | Blockchain event processing |
| 29 | `crates/api-utils/src/coins_ph_manager/client.rs` | Coins.ph API client |
| 30 | `crates/api-utils/src/coins_ph_manager/manager.rs` | Coins.ph integration manager |
| 31 | `crates/api-utils/src/fee_quota_manager.rs` | Fee quota/limit management |
| 32 | `crates/api-utils/src/firebase_manager.rs` | Firebase push notification manager |
| 33 | `crates/api-utils/src/invoice_manager/manager.rs` | Invoice creation/management |
| 34 | `crates/api-utils/src/invoice_manager/paypal_manager/client.rs` | PayPal API client |
| 35 | `crates/api-utils/src/invoice_manager/paypal_manager/manager.rs` | PayPal invoice manager |
| 36 | `crates/api-utils/src/invoice_manager/send_grid_manager/client.rs` | SendGrid API client |
| 37 | `crates/api-utils/src/invoice_manager/send_grid_manager/invoice_template.rs` | Invoice email template |
| 38 | `crates/api-utils/src/invoice_manager/send_grid_manager/manager.rs` | SendGrid invoice manager |
| 39 | `crates/api-utils/src/monitor_transactions_manager.rs` | Transaction monitoring |
| 40 | `crates/api-utils/src/oauth_manager.rs` | OAuth authentication manager |
| 41 | `crates/api-utils/src/on_off_ramp_manager.rs` | On/off ramp orchestration |
| 42 | `crates/api-utils/src/parsed_payment/module_guest_execute.rs` | Guest module payment execution |
| 43 | `crates/api-utils/src/payment_manager/manager.rs` | Core payment management |
| 44 | `crates/api-utils/src/payment_manager/notifier.rs` | Payment notification service |
| 45 | `crates/api-utils/src/payment_manager/payment_merchant/alchemy_pay_merchant/merchant.rs` | AlchemyPay merchant impl |
| 46 | `crates/api-utils/src/payment_manager/payment_merchant/bitrefill_merchant/merchant.rs` | Bitrefill merchant impl |
| 47 | `crates/api-utils/src/payment_manager/payment_merchant/bitrefill.rs` | Bitrefill integration |
| 48 | `crates/api-utils/src/payment_manager/payment_merchant/coins_merchant/merchant.rs` | Coins merchant impl |
| 49 | `crates/api-utils/src/payment_manager/payment_merchant/coins_ph_merchant/merchant.rs` | Coins.ph merchant impl |
| 50 | `crates/api-utils/src/payment_manager/payment_merchant/coins_ph_merchant/pending_order.rs` | Coins.ph pending order handler |
| 51 | `crates/api-utils/src/payment_manager/payment_merchant/merchants.rs` | Merchant registry/factory |
| 52 | `crates/api-utils/src/payment_manager/payment_merchant/paypal_merchant/merchant.rs` | PayPal merchant impl |
| 53 | `crates/api-utils/src/payment_manager/payment_merchant/wind_merchant/merchant.rs` | Wind merchant impl |
| 54 | `crates/api-utils/src/payment_manager/payment_merchant/wind_merchant/pending_wind_order.rs` | Wind pending order handler |
| 55 | `crates/api-utils/src/payment_manager/payment_submitter/bridge_validator_client.rs` | Bridge validator RPC client |
| 56 | `crates/api-utils/src/payment_manager/payment_submitter/pending_payment.rs` | Pending payment handler |
| 57 | `crates/api-utils/src/payment_manager/payment_submitter/pending_payments.rs` | Pending payments batch |
| 58 | `crates/api-utils/src/payment_manager/payment_submitter/recording_payment.rs` | Payment recording |
| 59 | `crates/api-utils/src/payment_manager/payment_submitter/recording_payments.rs` | Batch payment recording |
| 60 | `crates/api-utils/src/payment_router/router.rs` | Payment routing logic |
| 61 | `crates/api-utils/src/payment_router/routing.rs` | Payment route rules |
| 62 | `crates/api-utils/src/refresh_token_manager.rs` | Auth refresh token management |
| 63 | `crates/api-utils/src/relayer_client.rs` | Relayer RPC client |
| 64 | `crates/api-utils/src/single_fee_manager.rs` | Single fee calculation |
| 65 | `crates/api-utils/src/transaction_manager/manager.rs` | Transaction lifecycle manager |
| 66 | `crates/api-utils/src/transaction_manager/pending_transaction.rs` | Pending TX handler |
| 67 | `crates/api-utils/src/transaction_manager/transaction_submitter.rs` | Transaction submission |
| 68 | `crates/api-utils/src/transaction_manager/transaction_submitters.rs` | Multi-chain TX submitters |
| 69 | `crates/api-utils/src/utils.rs` | General utilities |
| 70 | `crates/api-utils/src/wind_manager/client.rs` | Wind API client |
| 71 | `crates/api-utils/src/wind_manager/manager.rs` | Wind integration manager |

### ❌ Other crates with business logic:

| # | File | Likely Purpose |
|---|------|----------------|
| 72 | `crates/common/src/auth.rs` | Authentication primitives |
| 73 | `crates/common/src/crypto.rs` | Cryptographic functions |
| 74 | `crates/common/src/payment.rs` | Payment types/helpers |
| 75 | `crates/payment-contracts/src/arb_gas_info.rs` | Arbitrum gas info contract |
| 76 | `crates/payment-contracts/src/dkim_keys.rs` | DKIM key contract interaction |
| 77 | `crates/payment-contracts/src/fee_estimator.rs` | On-chain fee estimator |
| 78 | `crates/payment-contracts/src/gas_estimator.rs` | Gas estimation contract |
| 79 | `crates/payment-contracts/src/module_guest.rs` | Module guest contract |
| 80 | `crates/payment-contracts/src/module_main.rs` | Module main contract |
| 81 | `crates/payment-contracts/src/singleton_factory.rs` | Singleton factory contract |
| 82 | `crates/payment-contracts/src/unipass_bridge.rs` | Bridge contract interaction |
| 83 | `crates/payment-contracts/src/unipass_factory.rs` | UniPass factory contract |
| 84 | `crates/smart-account-wallet/src/key/mod.rs` | Key management module |
| 85 | `crates/app-redis/src/stream/consumer.rs` | Redis stream consumer |
| 86 | `crates/logger/src/slack_webhook_writer.rs` | Slack notification logger |

**Total unaudited business logic files: ~86**

---

## 9. utxo-swap-sequencer (Rust)

**Audited:** `lib.rs`, `tx.rs`, `remove_liquidity.rs`, `manager.rs`, `batch_tx.rs`, `get_utxo_global.rs`, `checker.rs`, `intents.rs`

### ❌ UNAUDITED Handler/Service Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `crates/api/src/accounts/info.rs` | Account info query handler |
| 2 | `crates/api/src/accounts/login.rs` | Account login handler |
| 3 | `crates/api/src/chains_info.rs` | Chain info query handler |
| 4 | `crates/api/src/configurations.rs` | Configuration API handler |
| 5 | `crates/api/src/external/swap_utxo_global.rs` | External UTXO swap handler |
| 6 | `crates/api/src/github/create_issue.rs` | GitHub issue creation handler |
| 7 | `crates/api/src/github/upload_image.rs` | GitHub image upload handler |
| 8 | `crates/api/src/intents/add_liquidity.rs` | Add liquidity intent handler |
| 9 | `crates/api/src/intents/get_intent_status.rs` | Intent status query handler |
| 10 | `crates/api/src/intents/swap_exact_input_for_output.rs` | Exact input swap handler |
| 11 | `crates/api/src/intents/swap_input_for_exact_output.rs` | Exact output swap handler |
| 12 | `crates/api/src/pools/candlestick.rs` | Pool price candlestick data |
| 13 | `crates/api/src/pools/create_pool.rs` | Pool creation handler |
| 14 | `crates/api/src/pools/get_pool_by_tokens.rs` | Pool query by token pair |
| 15 | `crates/api/src/pools/pool_list.rs` | Pool listing handler |
| 16 | `crates/api/src/pools/status.rs` | Pool status handler |
| 17 | `crates/api/src/pools/transaction_list.rs` | Pool transaction list handler |
| 18 | `crates/api/src/status.rs` | System status handler |
| 19 | `crates/api/src/tasks/claim.rs` | Task claim handler |
| 20 | `crates/api/src/tasks/list.rs` | Task list handler |
| 21 | `crates/api/src/tokens/get_tokens.rs` | Token list handler |
| 22 | `crates/api/src/tokens/top_tokens.rs` | Top tokens ranking handler |
| 23 | `crates/api-common/src/context.rs` | API context/state |
| 24 | `crates/api-common/src/error.rs` | Error types |
| 25 | `crates/api-common/src/intents.rs` | Intent types/helpers |
| 26 | `crates/api-common/src/pools.rs` | Pool types/helpers |
| 27 | `crates/types/src/intent/parser.rs` | Intent parsing logic |
| 28 | `crates/types/src/utils.rs` | Type utility functions |
| 29 | `crates/utils/src/account_address/address.rs` | Account address resolution |
| 30 | `crates/utils/src/account_address/joy_id_client.rs` | JoyID wallet client |
| 31 | `crates/utils/src/ckb_explorer_client.rs` | CKB Explorer API client |
| 32 | `crates/utils/src/ckb_rpc_client.rs` | CKB RPC client |
| 33 | `crates/utils/src/external_manager/manager.rs` | External service manager |
| 34 | `crates/utils/src/intents_manager/intent_dao.rs` | Intent DAO operations |
| 35 | `crates/utils/src/intents_manager/manager.rs` | Intent lifecycle manager |
| 36 | `crates/utils/src/liquidity_pairs/lock.rs` | Liquidity pair locking |
| 37 | `crates/utils/src/liquidity_pairs/manager.rs` | Liquidity pair manager |
| 38 | `crates/utils/src/liquidity_pairs/pool.rs` | Pool state management |
| 39 | `crates/utils/src/liquidity_pairs/pools_creator/creator.rs` | Pool creation logic |
| 40 | `crates/utils/src/liquidity_pairs/pools_creator/pending_pool.rs` | Pending pool handler |
| 41 | `crates/utils/src/liquidity_pairs/pools_creator/runner.rs` | Pool creation runner |
| 42 | `crates/utils/src/liquidity_pairs/pools.rs` | Pool collection management |
| 43 | `crates/utils/src/liquidity_pairs/utils.rs` | Liquidity pair utilities |
| 44 | `crates/utils/src/lock_manager.rs` | Distributed lock manager |
| 45 | `crates/utils/src/oauth_middleware/middleware.rs` | OAuth middleware |
| 46 | `crates/utils/src/rate_limiter.rs` | Rate limiting |
| 47 | `crates/utils/src/redis.rs` | Redis client wrapper |
| 48 | `crates/utils/src/tasks_manager/manager.rs` | Task management service |
| 49 | `crates/utils/src/tokens_manager/inscription_updater.rs` | Inscription token updater |
| 50 | `crates/utils/src/tokens_manager/manager.rs` | Token management service |
| 51 | `crates/utils/src/tokens_manager/popular_tokens_updater.rs` | Popular tokens ranking updater |
| 52 | `crates/utils/src/tokens_manager/price_oracle.rs` | Token price oracle |
| 53 | `crates/utils/src/tokens_manager/updater.rs` | Token data updater |
| 54 | `crates/utils/src/tokens_manager/xudt_updater.rs` | xUDT token updater |
| 55 | `crates/utils/src/utils.rs` | General utilities |

**Total unaudited business logic files: ~55**

---

## 10. unipass-bridge-validator (Rust)

**Audited:** `handler.rs`, `submitter.rs`

### ❌ UNAUDITED Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `crates/api/src/validator_context.rs` | Validator API context/state |
| 2 | `crates/validator/src/api/collect_signature.rs` | Multi-sig collection handler |
| 3 | `crates/validator/src/api/payment_details.rs` | Payment details handler |
| 4 | `crates/validator/src/api/payment.rs` | Payment processing handler |
| 5 | `crates/validator/src/api/payment_status.rs` | Payment status handler |
| 6 | `crates/validator/src/api/validator_status.rs` | Validator status handler |
| 7 | `crates/validator/src/api/webhook.rs` | External webhook handler |
| 8 | `crates/validator/src/middleware.rs` | Request middleware |
| 9 | `crates/validator-handler/src/types.rs` | Handler type definitions |
| 10 | `crates/validator-handler/src/utils.rs` | Handler utility functions |
| 11 | `crates/validator-monitor/src/monitor.rs` | Bridge monitoring service |
| 12 | `crates/validator-monitor/src/utils.rs` | Monitor utility functions |
| 13 | `crates/validator-mq/src/consumer.rs` | Message queue consumer |
| 14 | `crates/validator-mq/src/producer.rs` | Message queue producer |
| 15 | `crates/validator-scheduler/src/scheduler.rs` | Task scheduler |
| 16 | `crates/validator-submitter/src/utils.rs` | Submitter utility functions |
| 17 | `crates/validator-daos/src/batched_payment.rs` | Batched payment DAO |
| 18 | `crates/validator-daos/src/bridge_event.rs` | Bridge event DAO |
| 19 | `crates/validator-daos/src/chain_info.rs` | Chain info DAO |
| 20 | `crates/validator-daos/src/input.rs` | Input DAO |
| 21 | `crates/validator-daos/src/output.rs` | Output DAO |
| 22 | `crates/validator-daos/src/payment.rs` | Payment DAO |
| 23 | `crates/validator-daos/src/processed_message.rs` | Processed message DAO |
| 24 | `crates/contracts-abi/src/unipass_bridge.rs` | Bridge contract ABI bindings |
| 25 | `crates/validator-log/src/slack_webhook_writer.rs` | Slack alert logger |
| 26 | `crates/configs/src/apollo_client.rs` | Apollo config client |
| 27 | `crates/configs/src/configs.rs` | Configuration management |

**Total unaudited business logic files: ~27**

---

## 11. unipass-wallet-relayer (Rust)

**Audited:** `transactions.rs`, `security.rs`

### ❌ UNAUDITED Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `crates/api/src/context.rs` | Relayer API context/state |
| 2 | `crates/api-utils/src/contract_error.rs` | Contract error handling |
| 3 | `crates/api-utils/src/utils.rs` | API utility functions |
| 4 | `crates/daos-relayer/src/transactions.rs` | Transaction DAO |
| 5 | `crates/execute-validator/src/execute_parser.rs` | Transaction execution parser |
| 6 | `crates/execute-validator/src/simulator/anvil_simulator.rs` | Anvil fork simulator |
| 7 | `crates/execute-validator/src/simulator/contract_simulator.rs` | Contract call simulator |
| 8 | `crates/execute-validator/src/types/module_guest_execute.rs` | Module guest execution types |
| 9 | `crates/execute-validator/src/types/parsed_transaction.rs` | Parsed transaction types |
| 10 | `crates/relayer/src/api/chain_id.rs` | Chain ID handler |
| 11 | `crates/relayer/src/api/meta_nonce.rs` | Meta nonce handler |
| 12 | `crates/relayer/src/api/nonce.rs` | Nonce handler |
| 13 | `crates/relayer/src/api/receipt.rs` | Transaction receipt handler |
| 14 | `crates/relayer/src/api/simulate.rs` | Transaction simulation handler |
| 15 | `crates/relayer/src/api/submitters.rs` | Submitter info handler |
| 16 | `crates/contracts-abi/src/arb_gas_info.rs` | Arbitrum gas info ABI |
| 17 | `crates/contracts-abi/src/dkim_keys.rs` | DKIM keys contract ABI |
| 18 | `crates/contracts-abi/src/fee_estimator.rs` | Fee estimator contract ABI |
| 19 | `crates/contracts-abi/src/gas_estimator.rs` | Gas estimator contract ABI |
| 20 | `crates/contracts-abi/src/module_guest.rs` | Module guest contract ABI |
| 21 | `crates/contracts-abi/src/module_main.rs` | Module main contract ABI |
| 22 | `crates/contracts-abi/src/singleton_factory.rs` | Singleton factory contract ABI |
| 23 | `crates/relayer-log/src/slack_webhook_writer.rs` | Slack alert logger |
| 24 | `crates/relayer-redis/src/lib.rs` | Redis client wrapper |
| 25 | `crates/tokens-manager/src/lib.rs` | Token management service |

**Total unaudited business logic files: ~25**

---

## 12. utxoswap-farm-sequencer (Rust)

**Audited:** `common.rs`, `harvest.rs`, `deposit.rs`, `withdraw_and_harvest.rs`, `tx.rs`, `submit.rs`, `security.rs`, `lock.rs`, `block_watcher.rs`, etc.

### ❌ UNAUDITED Files:

| # | File | Likely Purpose |
|---|------|----------------|
| 1 | `crates/api/src/configurations.rs` | Farm configuration API handler |
| 2 | `crates/api/src/intents/create_pool_intent.rs` | Create farm pool intent handler |
| 3 | `crates/api/src/intents/intent.rs` | Farm intent submission handler |
| 4 | `crates/api/src/intents/submit.rs` | Intent batch submission handler |
| 5 | `crates/api/src/intents/submit_create_pool_intent.rs` | Submit pool creation intent |
| 6 | `crates/api/src/pools/list.rs` | Farm pool listing handler |
| 7 | `crates/api/src/status.rs` | System status handler |
| 8 | `crates/api-common/src/context.rs` | API context/state |
| 9 | `crates/api-common/src/error.rs` | Error types |
| 10 | `crates/intent-solver/src/withdraw.rs` | Withdraw-only intent solver |
| 11 | `crates/types/src/checker.rs` | Intent/TX validation checker |
| 12 | `crates/types/src/parser.rs` | Intent parsing logic |
| 13 | `crates/types/src/utils.rs` | Type utilities |
| 14 | `crates/utils/src/lock_manager.rs` | Distributed lock manager |
| 15 | `crates/utils/src/pools_manager/intents_submitter.rs` | Intent submission runner |
| 16 | `crates/utils/src/pools_manager/manager.rs` | Pool lifecycle manager |
| 17 | `crates/utils/src/pools_manager/pools_handler/farm_pool/batch_tx.rs` | Farm pool batch TX builder |
| 18 | `crates/utils/src/pools_manager/pools_handler/farm_pool/pool.rs` | Farm pool state management |
| 19 | `crates/utils/src/pools_manager/pools_handler/farm_pool/runner.rs` | Farm pool processing runner |
| 20 | `crates/utils/src/pools_manager/pools_handler/handler.rs` | Pool handler orchestrator |
| 21 | `crates/utils/src/pools_manager/pools_handler/pool_creator/creator.rs` | Pool creation logic |
| 22 | `crates/utils/src/pools_manager/pools_handler/pool_creator/runner.rs` | Pool creation runner |
| 23 | `crates/utils/src/pools_manager/pools_handler/runner.rs` | Pool handler runner |
| 24 | `crates/utils/src/redis.rs` | Redis client wrapper |
| 25 | `crates/utils/src/swap_client.rs` | Swap RPC client |

**Total unaudited business logic files: ~25**

---

## GRAND SUMMARY

| # | Project | Total Files | Audited | Unaudited | Coverage % |
|---|---------|-------------|---------|-----------|------------|
| 1 | huehub-dex-backend | ~50 svc/ctrl | 3 | **~48** | ~6% |
| 2 | unipass-cms-backend | ~61 svc/ctrl | 2 | **~59** | ~3% |
| 3 | solagram-backend | ~36 svc/ctrl | 4 | **~32** | ~11% |
| 4 | unipass-wallet-backend | ~30 svc/ctrl | 6 | **~24** | ~20% |
| 5 | btc-assets-api | ~25 route/svc | 3 | **~23** | ~12% |
| 6 | unipass-wallet-oauth | ~14 svc/ctrl | 2 | **~12** | ~14% |
| 7 | mystery-bomb-box-backend | ~16 svc/ctrl | 2 | **~14** | ~13% |
| 8 | payment-server | ~90 handler/svc | 9 | **~86** | ~10% |
| 9 | utxo-swap-sequencer | ~63 handler/svc | 8 | **~55** | ~13% |
| 10 | unipass-bridge-validator | ~29 handler/svc | 2 | **~27** | ~7% |
| 11 | unipass-wallet-relayer | ~27 handler/svc | 2 | **~25** | ~7% |
| 12 | utxoswap-farm-sequencer | ~30 handler/svc | 10 | **~25** | ~33% |
| | **TOTALS** | **~471** | **53** | **~430** | **~11%** |

### 🔴 CRITICAL COVERAGE GAPS (Highest Risk):
1. **payment-server** — 86 unaudited files including payment merchants, transaction managers, ramp handlers
2. **unipass-cms-backend** — 59 unaudited files including all admin controllers, payment snap, relayer service
3. **utxo-swap-sequencer** — 55 unaudited files including all swap handlers, pool creation, token management
4. **huehub-dex-backend** — 48 unaudited files including all RGB++ services, launchpad, transaction builders
5. **solagram-backend** — 32 unaudited files including Telegram bot, Solana service, wallet operations
