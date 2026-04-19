/**
 * Minimal i18n. No framework — just a typed dictionary keyed by BCP-47
 * locale. Chosen in preference to `next-intl` because the verify page
 * has <20 strings and a heavy i18n framework is overkill.
 *
 * Callers detect the locale once (on first render) and stay on it; no
 * locale switcher UI ships with the verify page.
 */

export type Locale = "en" | "zh-CN";

export const DICT = {
  en: {
    title: "Verify your code",
    subtitle: "Enter the 6-digit code we emailed to",
    submit: "Verify",
    resend: "Resend code",
    resendIn: (s: string) => `Resend code in ${s}`,
    errorBadCode: "Incorrect code. Please try again.",
    errorExpired: "Code expired. Please request a new one.",
    errorRateLimited: "Too many attempts. Please wait and try again.",
    errorGeneric: "Something went wrong. Please try again.",
    verifying: "Verifying…",
    successHeadline: "Verified",
    successBody: "You're signed in. You may close this tab.",
    back: "Back",
  },
  "zh-CN": {
    title: "验证码校验",
    subtitle: "请输入发送至以下邮箱的 6 位验证码",
    submit: "提交",
    resend: "重新发送",
    resendIn: (s: string) => `${s} 后可重新发送`,
    errorBadCode: "验证码不正确，请重试。",
    errorExpired: "验证码已过期，请重新获取。",
    errorRateLimited: "尝试次数过多，请稍后再试。",
    errorGeneric: "出错了，请重试。",
    verifying: "验证中…",
    successHeadline: "验证成功",
    successBody: "已登录，可以关闭此页面。",
    back: "返回",
  },
} satisfies Record<Locale, Record<string, unknown>>;

const SUPPORTED: Locale[] = ["en", "zh-CN"];

/**
 * Pick a locale given a raw `navigator.languages` array (or similar
 * list of BCP-47 tags). Accepts both `zh-CN` and `zh-Hans-CN`. Falls
 * back to `en`.
 */
export function pickLocale(candidates: readonly string[] | undefined): Locale {
  if (!candidates) return "en";
  for (const raw of candidates) {
    const lower = raw.toLowerCase();
    if (lower === "en" || lower.startsWith("en-")) return "en";
    if (lower === "zh-cn" || lower.startsWith("zh-hans") || lower.startsWith("zh-cn")) {
      return "zh-CN";
    }
    if (lower === "zh" || lower.startsWith("zh-")) return "zh-CN";
  }
  return "en";
}

export function supportedLocales(): readonly Locale[] {
  return SUPPORTED;
}

export type Translations = typeof DICT["en"];
