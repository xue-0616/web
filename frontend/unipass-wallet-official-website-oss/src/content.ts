/**
 * Single source of truth for all marketing copy. Keeping the text as
 * data (not inline in `.astro` templates) makes it trivial to:
 *   * produce the same page in en + zh-CN without template duplication
 *   * unit-test the content structure (every locale exposes every key)
 */

export type Locale = "en" | "zh-CN";

export interface Feature {
  icon: string;
  title: string;
  body: string;
}

export interface PageCopy {
  hero: { headline: string; sub: string; ctaPrimary: string; ctaSecondary: string };
  features: Feature[];
  security: { headline: string; body: string; bullets: string[] };
  download: { headline: string; sub: string; platforms: { name: string; href: string; ext: string }[] };
  about: { headline: string; body: string };
}

export const COPY: Record<Locale, PageCopy> = {
  en: {
    hero: {
      headline: "The email-native self-custody wallet",
      sub: "Sign in with your email. Own your keys. No seed phrase required.",
      ctaPrimary: "Create wallet",
      ctaSecondary: "Read docs",
    },
    features: [
      {
        icon: "📧",
        title: "Email as identity",
        body: "Your email is your wallet. No browser extension, no 12-word seed to lose.",
      },
      {
        icon: "🔐",
        title: "Multi-chain native",
        body: "One account secures assets across Ethereum, BNB Chain, Arbitrum, and more.",
      },
      {
        icon: "⛽",
        title: "Gas sponsorship",
        body: "Free transactions for eligible users via ERC-4337 paymaster integration.",
      },
      {
        icon: "🧩",
        title: "Session keys",
        body: "Grant dApps scoped permissions that auto-expire — no phishing risk.",
      },
    ],
    security: {
      headline: "Security you can audit",
      body: "UniPass is built on open primitives. Every crypto operation is reviewable.",
      bullets: [
        "Open-source smart contract: MIT License",
        "Threshold ECDSA signing — no single point of key compromise",
        "zk-email recovery — social recovery without revealing guardians",
        "Audited by ChainSecurity and Halborn",
      ],
    },
    download: {
      headline: "Download",
      sub: "Use UniPass in any modern browser, or install our desktop/mobile companions.",
      platforms: [
        { name: "Web", href: "https://wallet.example", ext: "launch" },
        { name: "Chrome extension", href: "#", ext: "chrome" },
        { name: "iOS", href: "#", ext: "apple" },
        { name: "Android", href: "#", ext: "google" },
      ],
    },
    about: {
      headline: "About UniPass",
      body: "UniPass is built by a small team of cryptographers and product engineers who believe self-custody should not mean self-punishment.",
    },
  },
  "zh-CN": {
    hero: {
      headline: "以邮箱为入口的自托管钱包",
      sub: "用邮箱登录，自己掌握私钥，无需助记词。",
      ctaPrimary: "创建钱包",
      ctaSecondary: "查看文档",
    },
    features: [
      { icon: "📧", title: "邮箱即身份", body: "您的邮箱就是钱包，无需浏览器插件，也不必担心丢失 12 个助记词。" },
      { icon: "🔐", title: "原生多链", body: "一个账号，守护您在 Ethereum / BNB / Arbitrum 等链上的资产。" },
      { icon: "⛽", title: "Gas 代付", body: "通过 ERC-4337 paymaster，为符合条件的用户提供免 gas 交易。" },
      { icon: "🧩", title: "会话密钥", body: "为 dApp 授予可限期自动失效的权限，杜绝钓鱼风险。" },
    ],
    security: {
      headline: "安全性可审计",
      body: "UniPass 基于开放原语构建，所有密码学操作均可被审阅。",
      bullets: [
        "合约源代码开放（MIT 许可）",
        "门限 ECDSA 签名 — 没有单点泄密风险",
        "zk-email 恢复 — 不暴露守护人的社交恢复",
        "通过 ChainSecurity 与 Halborn 审计",
      ],
    },
    download: {
      headline: "下载",
      sub: "在任何现代浏览器中使用 UniPass，或安装桌面 / 移动应用。",
      platforms: [
        { name: "Web 版", href: "https://wallet.example", ext: "launch" },
        { name: "Chrome 扩展", href: "#", ext: "chrome" },
        { name: "iOS", href: "#", ext: "apple" },
        { name: "Android", href: "#", ext: "google" },
      ],
    },
    about: {
      headline: "关于 UniPass",
      body: "UniPass 由一支小而美的密码学家 + 产品工程师团队打造。我们相信：自托管不应意味着「自罚」。",
    },
  },
};
