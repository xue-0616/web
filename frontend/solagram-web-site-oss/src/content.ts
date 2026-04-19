/**
 * Marketing copy + feature matrix. Split out so non-engineers can edit
 * without touching Astro components, and so the content invariants
 * are testable (see content.test.ts).
 */

export interface Feature {
  title: string;
  body: string;
  icon: "wallet" | "chat" | "lock" | "zap" | "globe" | "coin";
}

export const HERO = {
  eyebrow: "Solana + Telegram",
  headline: "Your Solana wallet lives where your conversations live.",
  sub:
    "Solagram embeds a non-custodial Solana wallet inside Telegram. " +
    "Swap, send, and claim airdrops without leaving the chat.",
  ctaPrimary: { label: "Open in Telegram", href: "https://t.me/solagram_bot" },
  ctaSecondary: { label: "Read the docs", href: "/docs" },
};

export const FEATURES: readonly Feature[] = [
  {
    icon: "wallet",
    title: "Non-custodial by default",
    body:
      "Private keys are generated on-device and encrypted to your " +
      "Telegram cloud storage. We never touch them.",
  },
  {
    icon: "chat",
    title: "Share-to-send",
    body:
      "Send SOL or SPL tokens to any @handle in seconds. The recipient " +
      "gets a claimable link — no address copy-paste.",
  },
  {
    icon: "zap",
    title: "Jupiter-powered swaps",
    body:
      "Every trade routes through Jupiter v6 for best execution across " +
      "all Solana DEXs.",
  },
  {
    icon: "lock",
    title: "Biometric unlock",
    body:
      "Face ID / Touch ID guards every signature. Device-bound keys " +
      "make phishing impossible.",
  },
  {
    icon: "coin",
    title: "Airdrop radar",
    body:
      "Solagram watches your wallet and DMs you the moment a claimable " +
      "airdrop lands. One-tap claim, built in.",
  },
  {
    icon: "globe",
    title: "Open standard",
    body:
      "Built on Telegram Mini Apps + the Solana Wallet Standard. " +
      "Portable to any dApp that speaks the protocol.",
  },
];

export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Is Solagram custodial?",
    a:
      "No. Keys are generated client-side and sealed to your Telegram " +
      "cloud storage with a passphrase only you know. We cannot recover " +
      "a lost passphrase.",
  },
  {
    q: "Which tokens are supported?",
    a:
      "Native SOL plus any SPL token. The token list pulls from the " +
      "verified subset of Jupiter's strict list; unlisted tokens can be " +
      "added by mint address.",
  },
  {
    q: "What happens if I lose my phone?",
    a:
      "Sign in to Telegram on a new device, enter your passphrase, and " +
      "your wallet restores from cloud storage. Keys never leave the " +
      "encrypted blob.",
  },
  {
    q: "How much does it cost?",
    a:
      "Solagram itself is free. Swaps pay the Jupiter protocol fee " +
      "(~0.1%); transfers pay only Solana network fees (~$0.0003 per tx).",
  },
];

export const DOWNLOADS = [
  { platform: "Telegram", label: "Open @solagram_bot", href: "https://t.me/solagram_bot" },
  { platform: "Web", label: "Launch web app", href: "/app" },
];

export const NAV = [
  { label: "Features", href: "/#features" },
  { label: "FAQ", href: "/#faq" },
  { label: "Docs", href: "/docs" },
  { label: "Legal", href: "/legal" },
];

export const FOOTER = {
  tagline: "© 2026 Solagram Labs. Non-custodial. Open source.",
  links: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/legal" },
    { label: "GitHub", href: "https://github.com/solagram" },
  ],
};
