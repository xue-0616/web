/**
 * Mirror of tokens.css for TypeScript consumers (e.g. inline style
 * props that can't use CSS vars in IE — we don't support IE, but some
 * charting libs still require hex-as-string input).
 *
 * Synced with tokens.css. Bump TOKENS_VERSION on palette changes.
 */
export const TOKENS_VERSION = 1;

export const COLORS = {
  bg: "#0a0a0f",
  surface: "#12121a",
  surface2: "#1a1a24",
  border: "#26262f",
  fg: "#f4f4f7",
  fgDim: "#b8b8c4",
  muted: "#6b6b7c",
  accent: "#9945ff",
  accentHover: "#a865ff",
  gain: "#10b981",
  loss: "#f43f5e",
  warn: "#f59e0b",
  info: "#3b82f6",
} as const;

export const SPACE = {
  s1: "0.25rem", s2: "0.5rem", s3: "0.75rem", s4: "1rem",
  s5: "1.25rem", s6: "1.5rem", s8: "2rem", s10: "2.5rem",
  s12: "3rem",  s16: "4rem",
} as const;

export const RADIUS = { sm: "0.375rem", md: "0.75rem", lg: "1.25rem", full: "999px" } as const;
