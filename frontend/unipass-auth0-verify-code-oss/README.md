# `unipass-auth0-verify-code-oss`

**绿地重写**（生产 `*-src/` 是 nginx 占位页，无任何可参考代码）。

## 用途

Auth0 OTP 6 位验证码输入页。用户从邮件链接进入，输入 6 位数字，后端与 Auth0 换取 session token 并重定向回应用。

## 技术栈

- **Next.js 14** (App Router, server components)
- **React 18** hooks + testing-library 组件测试
- **Vitest** 单元测试 + jsdom 环境
- 零 CSS 框架（CSS 变量 + 暗色模式）

## 生产级特性

| 特性 | 位置 |
|---|---|
| 分格 6-box OTP 输入（移动端 `inputMode=numeric`） | `src/components/OtpInput.tsx` |
| Paste-to-splay（粘贴长串自动填满 6 格） | `src/lib/otp.ts::pasteSplay` + OtpInput 的 `onPaste` |
| Backspace 空格回退 / ←→ 键盘导航 | `OtpInput` 的 `onKeyDown` |
| auto-submit on complete entry | `VerifyPanel::onComplete` |
| 失败即清空 & `role="alert"` 宣告 | `VerifyPanel` `bad-code` 分支 |
| 30 秒 resend cooldown + 服务器可通过 `Retry-After` 覆盖 | `VerifyPanel` `cooldown` state |
| i18n `en` / `zh-CN`（基于 `navigator.languages`） | `src/lib/i18n.ts::pickLocale` |
| 暗色模式自动切换 | `src/app/globals.css` `prefers-color-scheme` |
| `noindex, nofollow` robots | `src/app/layout.tsx::metadata` |
| 服务端 Auth0 代理（client secret 不到浏览器） | `src/app/api/verify/route.ts` |

## 测试覆盖

4 个测试文件，~40 assertions：

| 文件 | 聚焦 |
|---|---|
| `src/lib/otp.test.ts` | 输入清洗、completion 判据、paste splay、键盘行为、倒计时格式 |
| `src/lib/i18n.test.ts` | locale 选择规则 + DICT 不变量（两种语言 key 一致） |
| `src/lib/api.test.ts` | HTTP response → VerifyOutcome 映射（200/400/410/429/500） |
| `src/components/VerifyPanel.test.tsx` | UI state machine：auto-submit / bad-code 清空 / expired / rate-limit 冷却 / i18n / paste |

## 运行

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # 生产构建
npm run test         # Vitest 单元测试
npm run typecheck    # tsc --noEmit
```

## 与 Auth0 对接

`src/app/api/verify/route.ts` 里 `TODO(phase6)` 处贴入：

```ts
const r = await fetch(`https://${process.env.AUTH0_DOMAIN}/passwordless/verify`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_id: process.env.AUTH0_CLIENT_ID,
    client_secret: process.env.AUTH0_CLIENT_SECRET,
    username: /* 用户邮箱 — 从 state cookie 读出 */,
    otp: code,
    realm: "email",
    grant_type: "http://auth0.com/oauth/grant-type/passwordless/otp",
  }),
});
```

## 与 `*-src/` 的关系

生产 `frontend/unipass-auth0-verify-code-src/` 不存在（可能从未解压），因此本项是纯绿地。UI 细节（品牌色、间距）按 UniPass 主站的 purple/violet 调色板做了保守匹配，可在 `src/app/globals.css` 的 CSS 变量中微调。
