/**
 * Tiny i18n — no React context, no provider. Just a `t()` function that
 * reads the current language from localStorage and returns the key if
 * no translation is found. Suitable for v1 scope.
 */
import { useEffect, useState } from "react";

export type Lang = "en" | "zh";

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    "connect": "Connect wallet",
    "disconnect": "Disconnect",
    "explore": "Explore",
    "portfolio": "Portfolio",
    "settings": "Settings",
    "balance": "Balance",
    "send": "Send",
    "receive": "Receive",
    "swap": "Swap",
    "loading": "Loading…",
    "empty.nothing": "Nothing here yet.",
    "error.generic": "Something went wrong.",
    "confirm": "Confirm",
    "cancel": "Cancel",
  },
  zh: {
    "connect": "连接钱包",
    "disconnect": "断开连接",
    "explore": "探索",
    "portfolio": "持仓",
    "settings": "设置",
    "balance": "余额",
    "send": "发送",
    "receive": "接收",
    "swap": "兑换",
    "loading": "加载中…",
    "empty.nothing": "这里还什么都没有。",
    "error.generic": "出错了。",
    "confirm": "确认",
    "cancel": "取消",
  },
};

const KEY = "lang";

export function useLang() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = (window.localStorage.getItem(KEY) as Lang | null);
    if (saved) setLang(saved);
  }, []);
  const set = (l: Lang) => {
    setLang(l);
    window.localStorage.setItem(KEY, l);
  };
  const t = (key: string) => DICT[lang][key] ?? key;
  return { lang, set, t };
}

export function LangToggle() {
  const { lang, set } = useLang();
  return (
    <button onClick={() => set(lang === "en" ? "zh" : "en")} className="lang" aria-label="Toggle language">
      {lang === "en" ? "EN" : "中"}
      <style>{`
        .lang {
          width: 36px; height: 36px; border-radius: var(--radius-full);
          background: var(--surface-2); color: var(--fg);
          font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.05em;
        }
        .lang:hover { background: var(--border); }
      `}</style>
    </button>
  );
}
