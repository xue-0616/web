# Security Audit Report — solagram-backend

**Date:** 2026-04-15  
**Scope:** Full source code review of `solagram-backend` (NestJS)  
**Focus:** Authentication, fund safety, input validation, trading logic, secrets management  

---

## Architecture Summary

| Component | Technology |
|---|---|
| Framework | NestJS 10 (Express) |
| Database | MySQL via TypeORM |
| Cache/Queue | Redis (ioredis) + Bull |
| Auth | JWT (RS256) via @nestjs/passport + passport-jwt |
| Identity | AWS Cognito |
| Telegram | node-telegram-bot-api (webhook mode) |
| Blockchain | Solana (Blink actions, token info, forwarding API) |

**Modules:** TgUser (auth/login), Wallet (connect, forwarding API, tx signing), Blink (short codes, action parsing), Solana (token info, transfers), Notify (Telegram notifications), TgBot (webhook message handling).

No direct trading endpoints (buy/sell/swap) exist in this backend. Fund-related logic is limited to wallet-connect flows and encrypted-key storage.

---

## Findings

### CRITICAL Severity

#### C-1: Authentication Bypass in Non-Production Environments

- **File:** `src/modules/tg-user/tg-user.service.ts` — `auth()` method
- **Description:** Telegram hash verification (`verifyTgHash`) is **only called when `NODE_ENV === 'prod'`**. In any other environment (dev, staging, test), **no authentication verification is performed** — the server trusts the `user` object in the request body as-is and issues a JWT.
  ```ts
  if (env === PROD_ENV) {
      await this.verifyTgHash(input);
  }
  ```
  An attacker against a non-prod instance can craft any `user.id` / `user.username` and receive a valid JWT.
- **Impact:** Complete authentication bypass, identity impersonation.
- **Fix:** Always call `verifyTgHash(input)` regardless of environment. If dev convenience is needed, use a separate explicit flag (e.g., `SKIP_TG_AUTH=true`) that is never set in deployed environments.

---

#### C-2: All AWS Cognito Users Share a Single Password

- **File:** `src/modules/tg-user/aws-user.service.ts` — `adminCreateUser()`, `adminSetUserPassword()`
- **File:** `src/common/utils-service/app.config.services.ts` — `awsConfig.userPoolPassword`
- **Description:** Every AWS Cognito user is created and authenticated with **the same password** (`awsUserPoolPassword` env var). If this password is leaked — through logs, config exposure, or a single compromised session — every user account in the Cognito pool is compromised.
  ```ts
  // All users get the same password
  this.appConfig.awsConfig.userPoolPassword
  ```
- **Impact:** Mass account takeover of all Cognito identities.
- **Fix:** Generate a unique, random password per user (or use a passwordless flow like Cognito custom auth challenges). Never store/reuse a global password for multiple user accounts.

---

#### C-3: Sensitive AWS Infrastructure Details Returned in Login Response

- **File:** `src/modules/tg-user/aws-user.service.ts` — `getCognitoResult()`
- **File:** `src/modules/tg-user/dto/login.output.dto.ts`
- **Description:** The login response sends to the client:
  - `region` (AWS region)
  - `identityPoolId` (Cognito Identity Pool ID)
  - `userPoolId` (Cognito User Pool ID)
  - `kmsKeyId` (AWS KMS Key ID)
  - `idToken` (Cognito token)
  
  Exposing `kmsKeyId` and `identityPoolId` to untrusted clients enables targeted attacks against AWS resources if IAM roles are misconfigured.
- **Impact:** Information disclosure; potential unauthorized AWS resource access.
- **Fix:** Only return the `idToken` to the client. Keep `kmsKeyId`, `identityPoolId`, and `userPoolId` server-side. If the frontend needs to call AWS directly, consider a proxy pattern.

---

### HIGH Severity

#### H-1: Redis Password Logged in Plaintext

- **File:** `src/common/utils-service/app.config.services.ts` — `redisConfig` and `queueConfig` getters
- **Description:** The Redis password is explicitly logged:
  ```ts
  this.logger.log(`password ${password}`);
  ```
  This appears in **both** `redisConfig` and `queueConfig` getters — the password ends up in log files on disk (Winston daily-rotate-file).
- **Impact:** Credential exposure via log files; compromised Redis access.
- **Fix:** Remove both `this.logger.log(`password ${password}`)` statements immediately.

---

#### H-2: Server-Side Request Forgery (SSRF) via Solana API Forwarding

- **File:** `src/modules/wallet/wallet.service.ts` — `forwardingSolanaApi()`
- **File:** `src/modules/wallet/wallet.controller.ts` — `forwardingSolanaApi()`
- **Description:** The endpoint takes a user-controlled `path`, `body`, and `method` and forwards the request to the configured Solana API base URL:
  ```ts
  let url = `${this.appConfig.walletConfig.solanaApi}${input.path}`;
  ```
  There is **no validation or whitelist** on `input.path`. An attacker can craft paths like `/../internal-service` or `@evil.com` to reach internal network services via URL manipulation, depending on the HTTP client behavior.
- **Impact:** SSRF — access to internal services, potential data exfiltration.
- **Fix:** Validate `input.path` against an allowlist of known API paths. Sanitize the URL to prevent path traversal, protocol injection, or host override. Consider parsing the final URL and rejecting anything that doesn't match the expected Solana API hostname.

---

#### H-3: Unrestricted CORS Policy

- **File:** `src/main.ts`
- **Description:** CORS is enabled twice with no origin restrictions:
  ```ts
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), { cors: true });
  app.enableCors();
  ```
  This allows **any website** to make authenticated requests to the API (when combined with credential-bearing headers).
- **Impact:** Cross-origin attacks; any malicious site can interact with the API on behalf of authenticated users.
- **Fix:** Configure CORS with an explicit `origin` allowlist:
  ```ts
  app.enableCors({ origin: ['https://your-frontend.com'], credentials: true });
  ```

---

#### H-4: No Rate Limiting on Authentication Endpoint

- **File:** `src/modules/tg-user/tg-user.controller.ts` — `auth()`
- **Description:** The login/auth endpoint has no rate limiting or throttling. Combined with the non-prod auth bypass (C-1), this allows unlimited JWT token generation.
- **Impact:** Brute-force attacks, token flooding, resource exhaustion.
- **Fix:** Add `@nestjs/throttler` or a Redis-based rate limiter to the auth endpoint (e.g., 5 requests per minute per IP).

---

#### H-5: JWT Guard Silently Fails Instead of Returning 401

- **File:** `src/auth/auth.guard.ts` — `canActivate()`
- **Description:** When token verification fails, the `catch` block returns `false` rather than throwing `UnauthorizedException`:
  ```ts
  catch (error) {
      this.logger.error(`...`);
      return false;  // Should throw UnauthorizedException
  }
  ```
  Additionally, there's double verification — `verifyToken()` and then `super.canActivate()` — which creates an inconsistency: `verifyToken` could pass while passport validation fails, or vice versa.
- **Impact:** Inconsistent auth behavior; clients receive 403 Forbidden instead of 401 Unauthorized, breaking standard auth flows and token refresh logic.
- **Fix:** Throw `UnauthorizedException` in the catch block. Remove the redundant `verifyToken()` call — let passport-jwt handle all token validation via `JwtStrategy`.

---

#### H-6: TLS Certificate Validation Disabled for Redis

- **File:** `src/common/utils-service/app.config.services.ts` — `redisConfig`
- **Description:** Redis TLS connections use `rejectUnauthorized: false`:
  ```ts
  tls: { rejectUnauthorized: false }
  ```
- **Impact:** Man-in-the-middle attacks on Redis connections; intercepted/modified data.
- **Fix:** Use proper CA certificates and set `rejectUnauthorized: true` in production. Provide the CA cert via environment configuration.

---

### MEDIUM Severity

#### M-1: Response Interceptor Logs Full Request Bodies and Response Data

- **File:** `src/interceptors/transform.interceptor.ts`
- **Description:** All request bodies and full response payloads are logged:
  ```ts
  this.logger.log(`... data = ${JSON.stringify(body)}, return = ${JSON.stringify(res)}`);
  ```
  This logs encrypted keys, JWT tokens, Cognito tokens, and all user data to disk.
- **Impact:** Sensitive data exposure in log files.
- **Fix:** Implement a sanitization layer that strips sensitive fields (`jwt`, `keyEncrypted`, `idToken`, `password`) before logging. Or log only non-sensitive metadata (URL, status code, timing).

---

#### M-2: Error Exception Filter Logs Full Request Bodies

- **File:** `src/filters/error.exception.filter.ts`
- **Description:** On error, the full request body and query are logged:
  ```ts
  JSON.stringify({ body: response.req.body, query: response.req.query })
  ```
- **Impact:** Sensitive data leaked into error logs.
- **Fix:** Same as M-1 — sanitize before logging.

---

#### M-3: Encrypted Key Address Uniqueness Not Scoped Per User

- **File:** `src/modules/tg-user/db/user-key-encrypted-db.service.ts` — `findOrInsert()`
- **Description:** When saving an encrypted key, the lookup checks address globally:
  ```ts
  let entity = await this.findOne({ address: input.address });
  if (entity) { return entity; }  // Returns existing entity regardless of user
  ```
  If user B submits the same address as user A, user B receives user A's encrypted key entity (or the save is silently skipped).
- **Impact:** Denial of service — an attacker can pre-register addresses to block legitimate users. Potential information leakage of key associations.
- **Fix:** Scope the lookup to the current user: `findOne({ address: input.address, userId })`.

---

#### M-4: Telegram Markdown Injection in Notifications

- **File:** `src/modules/notify/notify.service.ts` — `notify()`
- **Description:** The `input.message` is embedded directly into a Telegram message with `parse_mode: 'Markdown'`:
  ```ts
  let message = `${input.message}\n\n_Notification from ${source}_`;
  bot.sendMessage(entity.userId, message, { parse_mode: 'Markdown' });
  ```
  No sanitization of `input.message` or `source` is performed.
- **Impact:** Telegram Markdown injection; potential for phishing links or message formatting abuse.
- **Fix:** Escape Markdown special characters in user-controlled strings, or use `parse_mode: undefined` for untrusted content.

---

#### M-5: Swagger API Documentation Potentially Exposed in Production

- **File:** `src/setup-swagger.ts`, `src/main.ts`
- **Description:** Swagger docs are served at `/docs` when `enabledDocumentation` is true. If left on in production, the full API schema is publicly accessible.
- **Impact:** Information disclosure of all API endpoints, DTOs, and internal structure.
- **Fix:** Ensure `enabledDocumentation=false` in production config. Add authentication to the docs endpoint if it must be available.

---

#### M-6: Potential Cache Key Injection

- **File:** `src/modules/wallet/wallet.service.ts`, `src/modules/solana/solana.service.ts`
- **Description:** Cache keys are constructed with user-supplied values without sanitization:
  ```ts
  walletCacheKey(app, key) {
      return `${this.appConfig.nodeEnv}:Solagram:Message:${app}_${key}{tag}`;
  }
  ```
  While Redis key injection is limited in severity, crafted keys could cause cache poisoning or collisions.
- **Impact:** Cache poisoning, denial of service.
- **Fix:** Validate/sanitize user inputs used in cache key construction. Use a hash of user inputs rather than raw values.

---

### LOW Severity

#### L-1: No Security Headers (Helmet)

- **File:** `src/main.ts`
- **Description:** No `helmet` middleware or security headers are configured. Missing headers include `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.
- **Fix:** Install and apply `helmet` middleware.

---

#### L-2: Timing-Safe Comparison Not Used for Webhook Secret

- **File:** `src/modules/tg-bot/webhook.controller.ts`
- **Description:** Webhook secret token is compared with `!==` (standard string comparison), which is vulnerable to timing attacks:
  ```ts
  if (secretToken !== this.appConfig.webhookConfig.secretToken)
  ```
- **Fix:** Use `crypto.timingSafeEqual()` for secret comparison.

---

#### L-3: HTTP Retry Logs Sensitive Config/Params

- **File:** `src/common/utils-service/http.service.ts`
- **Description:** On HTTP errors, the full URL, config (may include API keys), and params are logged:
  ```ts
  this.logger.error(`[httpPost] error ... data=${JSON.stringify({ url, config, sendTimes, response })}`);
  // and
  this.logger.error(`[httpPost] error ... data=${JSON.stringify({ url, params, config, sendTimes, response })}`);
  ```
  The `config` object in Solana FM calls includes `headers: { ApiKey: ... }`.
- **Impact:** API keys logged to disk.
- **Fix:** Strip sensitive headers/fields before logging HTTP errors.

---

#### L-4: No HTTPS Enforcement

- **File:** `src/main.ts`
- **Description:** Server listens on plain HTTP. Relies entirely on a reverse proxy for TLS termination.
- **Fix:** Document the requirement for TLS termination at the reverse proxy. Consider adding HSTS header.

---

## Summary Table

| ID | Severity | Category | File(s) | Description |
|---|---|---|---|---|
| C-1 | **CRITICAL** | Authentication | tg-user.service.ts | Auth bypass in non-prod — no TG hash verification |
| C-2 | **CRITICAL** | Fund Safety | aws-user.service.ts | All Cognito users share single password |
| C-3 | **CRITICAL** | Info Disclosure | aws-user.service.ts | KMS Key ID, Identity Pool ID returned to client |
| H-1 | **HIGH** | Secrets | app.config.services.ts | Redis password logged in plaintext |
| H-2 | **HIGH** | Input Validation | wallet.service.ts | SSRF via unvalidated Solana API path forwarding |
| H-3 | **HIGH** | Access Control | main.ts | Unrestricted CORS — any origin allowed |
| H-4 | **HIGH** | Authentication | tg-user.controller.ts | No rate limiting on auth endpoint |
| H-5 | **HIGH** | Authentication | auth.guard.ts | Silent fail + double verification inconsistency |
| H-6 | **HIGH** | Transport | app.config.services.ts | Redis TLS cert validation disabled |
| M-1 | **MEDIUM** | Logging | transform.interceptor.ts | Full req/res logged (tokens, keys) |
| M-2 | **MEDIUM** | Logging | error.exception.filter.ts | Full request body logged on errors |
| M-3 | **MEDIUM** | Access Control | user-key-encrypted-db.service.ts | Encrypted key address not scoped per user |
| M-4 | **MEDIUM** | Input Validation | notify.service.ts | Telegram Markdown injection in notifications |
| M-5 | **MEDIUM** | Info Disclosure | setup-swagger.ts | Swagger docs potentially exposed in prod |
| M-6 | **MEDIUM** | Input Validation | wallet.service.ts, solana.service.ts | Cache key injection via unsanitized input |
| L-1 | **LOW** | Headers | main.ts | No security headers (helmet) |
| L-2 | **LOW** | Cryptography | webhook.controller.ts | Non-timing-safe secret comparison |
| L-3 | **LOW** | Logging | http.service.ts | API keys logged in HTTP error messages |
| L-4 | **LOW** | Transport | main.ts | No HTTPS enforcement |

**Total: 3 CRITICAL, 6 HIGH, 6 MEDIUM, 4 LOW**

---

## Priority Remediation Order

1. **Immediate (before next deploy):** C-1 (auth bypass), C-2 (shared Cognito password), H-1 (logged Redis password)
2. **Within 1 week:** C-3 (AWS info exposure), H-2 (SSRF), H-3 (CORS), H-5 (JWT guard fix)
3. **Within 1 month:** H-4 (rate limiting), H-6 (TLS validation), M-1–M-6 (all medium issues)
4. **Backlog:** L-1 through L-4
